import { doc, collection, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { parseAiDrugDetail } from './parseAiDrugDetail';
import { autoTagDrugConditions } from './autoTagConditions';
import { apiUrl } from '../config/apiBase';
import { drugMatchesConditionKeywords } from '../data/systemConditions';

// Wait for Firebase Auth session to restore, then verify sign-in
async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save drugs.');
  }
  return auth.currentUser;
}

// ── Contributor / review-queue support ─────────────────────────────────────
// Every write this file makes goes through here so we know, cheaply and
// consistently, whether the person making the write is an admin. Non-admin
// writes get flagged `needs_review: true` with who/when metadata instead of
// silently landing as if an admin had vetted them — this is what powers the
// /admin/review queue. Cached per uid for the life of the tab since role
// doesn't change mid-session; a failed role lookup fails safe (treated as
// non-admin, so it still lands in the review queue rather than skipping it).
let _roleCache = null; // { uid, isAdmin }
async function getContributorInfo() {
  const user = await getAuthUser();
  if (_roleCache && _roleCache.uid === user.uid) {
    return { uid: user.uid, email: user.email || 'unknown', isAdmin: _roleCache.isAdmin };
  }
  let isAdmin = false;
  try {
    // Admin status lives in admins/{email} (same collection AuthContext.js,
    // the login pages, and the server-side requireAdmin all check) — NOT
    // users/{uid}.role, which is never actually set to 'admin' anywhere in
    // this app. Checking the wrong collection here meant every admin's AI
    // save was silently treated as a non-admin contribution.
    const snap = await getDoc(doc(db, 'admins', user.email || ''));
    isAdmin = snap.exists() && snap.data()?.role === 'admin';
  } catch {
    isAdmin = false;
  }
  _roleCache = { uid: user.uid, isAdmin };
  return { uid: user.uid, email: user.email || 'unknown', isAdmin };
}

// Builds the metadata block attached to every drug write. Admin writes are
// marked reviewed outright (they ARE the review); non-admin writes are
// flagged for the queue with who made them and when.
function buildReviewMeta({ uid, email, isAdmin }, contributionType) {
  return isAdmin
    ? { needs_review: false, reviewed_by: email, reviewed_at: serverTimestamp() }
    : {
        needs_review: true,
        contribution_type: contributionType, // 'new' | 'update'
        contributed_by_uid: uid,
        contributed_by_email: email,
        contributed_at: serverTimestamp(),
      };
}

// ── Admin review-queue actions ──────────────────────────────────────────────
// Approve: keep the content as-is, just clear the flag.
export async function approveDrugReview({ id }) {
  const { email } = await getContributorInfo();
  await updateDoc(doc(db, 'drugs', id), {
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
  });
}

// Reject & restore: only meaningful when a previous (pre-overwrite) version
// was snapshotted — puts the record back exactly as it was before the
// non-admin write touched it.
export async function restoreDrugPreviousVersion({ id, previousVersion }) {
  if (!previousVersion) throw new Error('No previous version was saved for this drug.');
  const { email } = await getContributorInfo();
  await setDoc(doc(db, 'drugs', id), {
    ...previousVersion,
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
    last_updated: serverTimestamp(),
  }, { merge: false });
}

// Save admin edits made directly on the review page, and clear the flag in
// the same write.
export async function saveReviewedDrugEdits({ id, edits }) {
  const { email } = await getContributorInfo();
  await updateDoc(doc(db, 'drugs', id), {
    ...edits,
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: null,
    last_updated: serverTimestamp(),
  });
}

export async function deleteReviewedDrug({ id }) {
  await getAuthUser();
  await deleteDoc(doc(db, 'drugs', id));
}

// Used by DrugDetailPage's non-admin "per-tab AI insight" background save —
// the one place outside saveAiDrugToDatabase/saveParsedDrug that writes AI
// text straight onto an existing drug record. `fields` is the exact set of
// keys about to be written (e.g. just `strength`, or the full parsed set).
// Snapshots only those fields' current values (not the whole doc) so a
// reject on the review page restores precisely what was there before,
// without disturbing anything else on the record.
export async function saveTabAiInsight({ drugId, drug, fields }) {
  const contributor = await getContributorInfo();
  const priorTouchedFields = {};
  Object.keys(fields).forEach(k => { priorTouchedFields[k] = drug[k] ?? null; });

  const previousVersion = (!contributor.isAdmin && !drug.needs_review)
    ? priorTouchedFields
    : (drug.previous_version ?? null);

  await updateDoc(doc(db, 'drugs', drugId), {
    ...fields,
    last_updated: serverTimestamp(),
    ...buildReviewMeta(contributor, 'update'),
    previous_version: previousVersion,
  });
}

// ── AI Assistant (admin "instruct the app" tool) ───────────────────────────
// Calls /api/ai-admin-instruct to turn a plain-language instruction into
// structured, proposed edits. Never writes to Firestore itself — the admin
// reviews a before/after diff and applies each edit individually via
// applyAiAdminEdit below.
export async function fetchAiAdminInstruction({ instruction }) {
  const user = await getAuthUser();
  const token = await user.getIdToken();
  const res = await fetch(apiUrl('/api/ai-admin-instruct'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instruction }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data; // { understood, clarification, edits: [...] }
}

// Applies one admin-approved edit to a drug doc, snapshotting the prior
// value for rollback (same previous_version convention as the review
// queue) and logging the change to ai_admin_edit_log for audit purposes —
// this tool can touch any field on any drug, so every applied edit needs a
// paper trail of who approved it, from what instruction, and what changed.
export async function applyAiAdminEdit({ drugId, drug, instruction, field, previousValue, newValue }) {
  const { email } = await getContributorInfo();

  await updateDoc(doc(db, 'drugs', drugId), {
    [field]: newValue,
    last_updated: serverTimestamp(),
    needs_review: false,
    reviewed_by: email,
    reviewed_at: serverTimestamp(),
    previous_version: { ...(drug.previous_version || {}), [field]: previousValue ?? null },
  });

  try {
    await setDoc(doc(collection(db, 'ai_admin_edit_log')), {
      drugId,
      drugName: drug.generic_name || drug.id,
      instruction,
      field,
      previousValue: previousValue ?? null,
      newValue,
      appliedBy: email,
      appliedAt: serverTimestamp(),
    });
  } catch (e) {
    // Audit log failure should never block the edit that already succeeded.
    console.warn('[applyAiAdminEdit] audit log write failed:', e.message);
  }

  autoTagDrugConditions(drugId, { ...drug, [field]: newValue }).catch(() => {});
}


export function slugifyDrugName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

// ── Required field groups ─────────────────────────────────────────────────
// Each group lists ALL possible field name aliases for the same concept.
// A group is "satisfied" if ANY alias has >= MIN_LENGTH chars.
// This handles both AI-generated schema (indications/pharmacology/nursing_action)
// and legacy CSV schema (primary_indications/mechanism/nursing_considerations).
const MIN_LENGTH = 50;
export const REQUIRED_FIELD_GROUPS = [
  { label: 'Overview',                aliases: ['overview']                                      },
  { label: 'Indications',             aliases: ['indications', 'primary_indications']            },
  { label: 'Dosage',                  aliases: ['adult_dose', 'dosage']                          },
  { label: 'Mechanism / Pharmacology',aliases: ['pharmacology', 'mechanism']                     },
  { label: 'Adverse Effects',         aliases: ['adverse_effect', 'side_effects']                },
  { label: 'Contraindications',       aliases: ['contraindications']                             },
  { label: 'Nursing Considerations',  aliases: ['nursing_action', 'nursing_considerations']      },
];

export function getMissingGroups(data) {
  return REQUIRED_FIELD_GROUPS.filter(g =>
    !g.aliases.some(f => data[f] && String(data[f]).trim().length >= MIN_LENGTH)
  );
}

export function isDrugComplete(data) {
  return getMissingGroups(data).length === 0;
}

// ── Detect a "drug not found / not recognized" AI response ─────────────────
// The AI is instructed to say so plainly (instead of inventing information)
// when it isn't confident a name corresponds to a real generic, brand, or
// combination product. Previously that text was parsed and saved to the
// database exactly like a real result. This catches that response so it can
// be rejected instead of saved.
const NOT_FOUND_PATTERNS = [
  /\bnot\s+(a\s+)?(recognized|real|known|valid)\b.{0,40}\b(drug|medication|brand|generic)\b/i,
  /\bnot\s+confident\b.{0,80}\b(real|corresponds?|generic|brand)\b/i,
  /\b(does not|doesn'?t)\s+(correspond|match)\b.{0,60}\b(any|a)\b.{0,20}\b(real|known|recognized)\b/i,
  /\b(could not|couldn'?t|cannot|can'?t|unable to)\s+(find|identify|locate|confirm)\b.{0,60}\b(drug|medication|brand|generic|information)\b/i,
  /\bno\s+(reliable\s+)?information\s+(found|available)\b.{0,40}\b(drug|medication|brand)\b/i,
  /^\s*(not available|not known|unknown|unrecognized|no data)\s*$/im,
];

export function isDrugNotFoundText(text) {
  if (!text || !text.trim()) return true;
  const head = text.slice(0, 600); // refusals are stated up front, not buried deep in the response
  return NOT_FOUND_PATTERNS.some(re => re.test(head)) || NOT_FOUND_PATTERNS.some(re => re.test(text));
}

// ── Fetch AI text for a drug ──────────────────────────────────────────────
export async function fetchAiDrugText({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genericName, drugClass: drugClass || undefined, notInDatabase: true }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Fast, minimal-token strength-only lookup ──────────────────────────────
// Used when a drug already has all other required fields and only needs
// its formulation strength filled in — skips the full 20-field generation
// and only writes the single 'strength' field, so it's much faster/cheaper
// than a full regenerate + save.
export async function fetchStrengthText({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'strength', genericName, drugClass: drugClass || undefined }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  full = full.trim();
  if (!full) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Fast, minimal-token pronunciation-only lookup ─────────────────────────
// Mirrors fetchStrengthText — a single short phonetic-spelling line, not
// part of REQUIRED_FIELD_GROUPS, so it never affects a drug's "complete" status.
export async function fetchPronunciationText({ genericName, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'pronunciation', genericName }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  // Guard against a stray header/quotes/bullet the model might still add.
  full = full.trim().replace(/^#{1,6}\s*/, '').replace(/^["'*-]+\s*/, '').replace(/["'*]+$/, '');
  if (!full) throw new Error('AI returned an empty response.');
  return full.trim();
}

// Saves just the pronunciation field onto an existing drug record (or
// creates one, same fallback as fillTabWithAi, if this drug only exists
// as a local seed entry so far). Any signed-in user may call this — same
// permission model as the per-tab AI fill.
export async function savePronunciation({ drug, pronunciation }) {
  await getAuthUser();
  await setDoc(doc(db, 'drugs', drug.id), {
    pronunciation,
    generic_name: drug.generic_name,
    drug_class:   drug.drug_class || 'Unknown',
    source:       drug.source || 'AI Generated',
    status:       drug.status || 'Active',
    last_updated: serverTimestamp(),
  }, { merge: true });
}

export async function fetchBrandsText({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'brands', genericName, drugClass }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  full = full.trim().replace(/^#{1,6}\s*/, '').replace(/^["'*-]+\s*/, '').replace(/["'*]+$/, '');
  if (!full) throw new Error('AI returned an empty response.');
  return full.trim();
}

// Saves just the brand_names field onto an existing drug record. Any
// signed-in user may call this — same permission model as pronunciation.
export async function saveBrandNames({ drug, brandNames }) {
  await getAuthUser();
  await setDoc(doc(db, 'drugs', drug.id), {
    brand_names:  brandNames,
    generic_name: drug.generic_name,
    drug_class:   drug.drug_class || 'Unknown',
    source:       drug.source || 'AI Generated',
    status:       drug.status || 'Active',
    last_updated: serverTimestamp(),
  }, { merge: true });
}

// A drug only needs the fast strength-only path if every other required
// field is already complete and strength itself is still missing.
export function needsStrengthOnly(data) {
  return isDrugComplete(data) && !(data.strength && String(data.strength).trim());
}

// Writes only the strength field (+ last_updated) — no confirmation needed
// since this never overwrites existing populated data, only fills a gap.
export async function saveStrengthOnly({ docId, strengthText }) {
  await getAuthUser();
  await updateDoc(doc(db, 'drugs', docId), {
    strength:     strengthText,
    last_updated: serverTimestamp(),
  });
  return { status: 'saved', id: docId };
}

// ── Fetch a broader list of drugs for a clinical condition ─────────────────
// Mirrors the 'class' mode fetch but keyed on a clinical condition instead
// of a drug class — used by SystemPage's condition cards.
export async function fetchConditionDrugList({ conditionLabel, systemName, knownDrugNames, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'condition', conditionLabel, systemName: systemName || undefined, knownDrugNames }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Classify a searched condition into the existing system taxonomy ────────
// Returns { systemId, icon, keywords } parsed from the "System:/Icon:/
// Keywords:" block the classify_condition AI mode replies with.
export async function fetchConditionClassification({ conditionLabel, systemOptions, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'classify_condition', conditionLabel, systemOptions }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }

  const clean = full.replace(/\*\*/g, '').replace(/`/g, '');
  const systemMatch   = clean.match(/System:\s*([a-z_]+)/i);
  const iconMatch     = clean.match(/Icon:\s*(\S+)/u);
  const keywordsMatch = clean.match(/Keywords:\s*(.+)/i);

  const systemId = systemMatch ? systemMatch[1].trim().toLowerCase() : '';
  if (!systemId || !Array.isArray(systemOptions) || !systemOptions.some(s => s.id === systemId)) {
    throw new Error('AI could not confidently classify this condition into a system.');
  }
  return {
    systemId,
    icon: iconMatch ? iconMatch[1].trim() : '🩺',
    keywords: keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : [conditionLabel.trim().toLowerCase()],
  };
}

// ── Fetch AI clinical primer + drug list for a searched condition/indication ──
// Used by BrowsePage's search-driven "condition insight" card. Same streaming
// contract as fetchConditionDrugList — returns the full streamed text once
// the response finishes.
export async function fetchConditionInsight({ conditionLabel, knownDrugNames, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'condition_insight', conditionLabel, knownDrugNames }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Fetch AI structured clinical teaching summary for a condition ──────────
// Powers the admin "Add Clinical Info" panel on SystemPage. Same streaming
// contract as fetchConditionInsight; the returned markdown is parsed by
// parseConditionClinicalInfo into the 7 fixed sections before saving.
export async function fetchConditionClinicalInfo({ conditionLabel, systemName, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'condition_clinical_info', conditionLabel, systemName }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Fetch AI-suggested drug list for a drug class ───────────────────────────
export async function fetchClassDrugList({ className, knownDrugNames, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'class', className, knownDrugNames }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Fetch AI-suggested additional conditions for a body system ─────────────
export async function fetchSystemConditionsList({ systemName, existingLabels, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'system_conditions', systemName, existingLabels }),
  });

  if (!res.ok) {
    let message = 'Failed to reach the AI service.';
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response body from AI service.');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  if (!full.trim()) throw new Error('AI returned an empty response.');
  return full.trim();
}

// ── Generate, validate, and save a drug ──────────────────────────────────
// generateDrugOnce: generates AI text for one drug and returns parsed result
// with completeness status. Does NOT save to Firestore.
export async function generateDrugOnce({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const text   = await fetchAiDrugText({ genericName, drugClass, endpoint });
  const parsed = parseAiDrugDetail(text);
  const missing = getMissingGroups(parsed);
  return { parsed, missing, complete: missing.length === 0 };
}

// saveParsedDrug: patches ONLY missing fields into the existing Firestore doc.
// Existing populated fields are NEVER overwritten — this is a surgical patch.
export async function saveParsedDrug({ genericName, drugClass, parsed, existingDrug = null }) {
  const contributor = await getContributorInfo();
  const docId = slugifyDrugName(genericName);
  const ref   = doc(db, 'drugs', docId);

  // Load existing doc if not passed in
  const snap     = existingDrug ? null : await getDoc(ref);
  const existing = existingDrug || (snap?.exists() ? snap.data() : null);

  // Build patch of ONLY fields that are missing/empty in the existing doc
  const patch = {};

  for (const group of REQUIRED_FIELD_GROUPS) {
    // Skip if existing doc already satisfies this group
    const alreadyFilled = existing && group.aliases.some(
      f => existing[f] && String(existing[f]).trim().length >= MIN_LENGTH
    );
    if (alreadyFilled) continue;

    // Use the best AI value for this group
    for (const alias of group.aliases) {
      if (parsed[alias] && String(parsed[alias]).trim().length >= MIN_LENGTH) {
        patch[alias] = parsed[alias];
        break;
      }
    }
  }

  // Optional fields — only patch if currently empty
  for (const f of ['drug_subclass', 'strength']) {
    if (!existing?.[f] && parsed[f] && String(parsed[f]).trim().length > 0) {
      patch[f] = parsed[f];
    }
  }

  // drug_class fallback
  if (!existing?.drug_class && (drugClass || parsed.drug_class)) {
    patch.drug_class = drugClass || parsed.drug_class;
  }

  if (Object.keys(patch).length === 0) {
    return { status: 'skipped', id: docId, reason: 'nothing new to patch' };
  }

  patch.last_updated = serverTimestamp();

  if (existing) {
    // Patch — never touch existing data. This never overwrites anything
    // already there, so there's nothing to snapshot — but a non-admin patch
    // still gets flagged so the newly-added fields get a look before they're
    // trusted the same as verified content.
    await updateDoc(ref, { ...patch, ...buildReviewMeta(contributor, 'update') });
  } else {
    // Brand-new drug — full write
    await setDoc(ref, {
      generic_name:        genericName,
      drug_class:          drugClass || parsed.drug_class || 'Unknown',
      drug_subclass:       parsed.drug_subclass || null,
      prescription_status: parsed.prescription_status || 'Prescription',
      source:              'AI Generated',
      status:              'Active',
      created_at:          serverTimestamp(),
      ...parsed,
      ...patch,
      ...buildReviewMeta(contributor, 'new'),
    });
  }

  // Re-run condition auto-tagging whenever this is a brand-new drug, or the
  // patch touched indications (the field condition-matching actually reads)
  // — no point re-checking on a patch that only filled in, say, dosage.
  if (!existing || patch.indications || patch.primary_indications) {
    await autoTagDrugConditions(docId, { ...existing, ...parsed, ...patch, generic_name: genericName });
  }

  return { status: 'saved', id: docId, patched: Object.keys(patch) };
}

// ── Force-regenerate: full overwrite, no gap-filling ───────────────────────
// Unlike saveParsedDrug (surgical patch — never touches a field that's
// already populated) this REPLACES every AI-parsed field on the drug with
// a fresh answer, regardless of what was there before, including fields a
// contributor or admin previously edited by hand. This exists specifically
// to push the new external-grounding update (openFDA/RxNorm + Gemini
// always-search — see api/drug-ai-details.js) into drugs that already look
// "complete" and so would never be touched by the incomplete-only bulk fix.
//
// Always calls the Gemini endpoint regardless of whichever provider is
// selected in Admin Settings for other AI Insight features, since Gemini
// is currently the only provider with BOTH grounding mechanisms (its own
// Google Search tool + the openFDA/RxNorm pre-fetch) active on every
// lookup. If that changes, update GEMINI_ENDPOINT below rather than
// silently picking up whatever the admin has selected elsewhere.
const GEMINI_ENDPOINT = '/api/drug-ai-details';

export async function forceRegenerateDrug({ genericName, drugClass }) {
  const contributor = await getContributorInfo();
  const docId = slugifyDrugName(genericName);
  const ref   = doc(db, 'drugs', docId);

  const text = await fetchAiDrugText({ genericName, drugClass, endpoint: GEMINI_ENDPOINT });
  const parsed = parseAiDrugDetail(text);

  if (isDrugNotFoundText(text)) {
    return { status: 'not_found', id: docId };
  }

  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;

  // Full overwrite of every AI-parsed field — no "already filled, skip it"
  // check, unlike saveParsedDrug's patch. Firestore-only bookkeeping fields
  // (created_at, generic_name, drug_class fallback) are preserved from the
  // existing doc where sensible rather than reset.
  await setDoc(ref, {
    generic_name:        genericName,
    drug_class:          drugClass || parsed.drug_class || existing?.drug_class || 'Unknown',
    prescription_status: parsed.prescription_status || existing?.prescription_status || 'Prescription',
    source:              existing?.source || 'AI Generated',
    status:              existing?.status || 'Active',
    created_at:          existing?.created_at || serverTimestamp(),
    ...parsed,
    last_updated:        serverTimestamp(),
    ...buildReviewMeta(contributor, 'update'),
  }, { merge: false });

  if (parsed.indications || parsed.primary_indications) {
    await autoTagDrugConditions(docId, { ...parsed, generic_name: genericName });
  }

  return { status: 'regenerated', id: docId };
}


// Used anywhere a drug is about to be used for a safety judgement (e.g. the
// Drug Compatibility Checker) rather than just displayed. A drug's own
// record can be thin — imported from an old CSV, saved mid-Class-Sweep
// before every field resolved, etc — and REQUIRED_FIELD_GROUPS (in
// particular Contraindications, Mechanism/Pharmacology, and Adverse
// Effects) are exactly the clinical parameters a "safe to combine or not"
// judgement should never be made without. This checks completeness first
// (free, no network call) and only reaches out to the AI if something is
// actually missing. It patches ONLY the missing fields via saveParsedDrug
// (surgical — never overwrites data that's already there), then re-checks
// completeness on the merged result so the caller knows definitively
// whether the drug is now safe to use for flagging, or whether even the
// AI/web lookup couldn't fill every required parameter.
export async function ensureDrugComplete({ drug, endpoint = '/api/drug-ai-details' }) {
  if (!drug || !drug.generic_name) {
    return { drug, wasIncomplete: false, completed: false, missingGroups: REQUIRED_FIELD_GROUPS };
  }
  if (isDrugComplete(drug)) {
    return { drug, wasIncomplete: false, completed: true, missingGroups: [] };
  }

  try {
    const text   = await fetchAiDrugText({ genericName: drug.generic_name, drugClass: drug.drug_class, endpoint });
    const parsed = parseAiDrugDetail(text);
    const result = await saveParsedDrug({
      genericName: drug.generic_name,
      drugClass: drug.drug_class,
      parsed,
      existingDrug: drug,
    });

    // Merge only the fields that actually got patched into a fresh copy of
    // the drug object, so the caller has complete data immediately without
    // needing to re-read from Firestore.
    const patchedFields = {};
    if (Array.isArray(result.patched)) {
      result.patched.forEach(f => { if (parsed[f] !== undefined) patchedFields[f] = parsed[f]; });
    }
    const merged = {
      ...drug,
      ...patchedFields,
      drug_class: drug.drug_class || patchedFields.drug_class || parsed.drug_class || drug.drug_class,
    };
    const stillMissing = getMissingGroups(merged);
    return { drug: merged, wasIncomplete: true, completed: stillMissing.length === 0, missingGroups: stillMissing };
  } catch (e) {
    // AI/network failure — the drug remains exactly as incomplete as it
    // started. Caller must treat this the same as "could not be completed".
    return { drug, wasIncomplete: true, completed: false, missingGroups: getMissingGroups(drug), error: e.message };
  }
}
// AiDrugPage and BrowsePage call this directly with pre-fetched text.
// We parse and validate here — only save if complete.
export async function saveAiDrugToDatabase({ genericName, drugClass, text, overwrite = true }) {
  const contributor = await getContributorInfo();

  // Reject outright refusals ("not a recognized drug", "not available",
  // etc.) before ever parsing/saving anything — a failed lookup must never
  // create or overwrite a database entry.
  if (isDrugNotFoundText(text)) {
    throw new Error(`"${genericName}" could not be identified as a real drug/brand — nothing was saved.`);
  }

  const parsed    = parseAiDrugDetail(text);
  const missing   = getMissingGroups(parsed);

  // Belt-and-braces: if the response didn't even resolve into real clinical
  // content (e.g. almost every required section came back empty), treat it
  // the same as a failed lookup rather than saving a near-blank record.
  if (missing.length >= REQUIRED_FIELD_GROUPS.length - 1) {
    throw new Error(`"${genericName}" returned little to no usable clinical information — nothing was saved.`);
  }

  const finalClass = drugClass || parsed.drug_class || 'Unknown';
  const docId     = slugifyDrugName(genericName);
  const ref       = doc(db, 'drugs', docId);

  // ALWAYS save real AI search results — even if a couple fields are still
  // incomplete, and even if a drug with this name already exists (it gets
  // replaced). Duplicate cleanup will be handled later via an admin
  // duplicate detector. Genuine "not found" responses are rejected above,
  // before reaching this point.
  const existing = await getDoc(ref);
  const existingData = existing.exists() ? existing.data() : null;

  // If a non-admin write is about to replace a record that was previously
  // clean (admin-authored or already-reviewed), snapshot it first so the
  // review queue can restore it exactly instead of just deleting the new
  // (possibly wrong) version and losing the old one too.
  const previousVersion = (!contributor.isAdmin && existingData && !existingData.needs_review)
    ? existingData
    : (existingData?.previous_version ?? null);

  await setDoc(ref, {
    ...parsed,
    generic_name:        genericName,
    drug_class:          finalClass,
    drug_subclass:       parsed.drug_subclass       || null,
    prescription_status: parsed.prescription_status || 'Prescription',
    nafdac_no:           null,
    source:              'AI Generated',
    status:              'Active',
    created_at:  existing.exists()
      ? (existingData.created_at || serverTimestamp())
      : serverTimestamp(),
    last_updated: serverTimestamp(),
    ...buildReviewMeta(contributor, existing.exists() ? 'update' : 'new'),
    previous_version: previousVersion,
  }, { merge: false });

  // Auto-tag this drug onto any conditions whose keywords match its
  // indications — so a newly-searched drug shows up under the right
  // condition cards immediately, with no manual tagging step.
  await autoTagDrugConditions(docId, { ...parsed, generic_name: genericName });

  // Always 'saved'. missingGroups is informational only — never blocks saving.
  return { status: 'saved', id: docId, missingGroups: missing };
}

// Same normalisation used by ConditionSection.js and AiInsightContext.js,
// duplicated here rather than imported so this util doesn't depend on any
// component — matches the pattern already established elsewhere in this app.
function normalizeDrugNameForMatch(name) {
  let n = (name || '').trim().toLowerCase();
  n = n.replace(/[\s/.+-]+/g, ' ').trim();
  n = n.replace(/\bco (\w)/g, 'co$1');
  n = n
    .replace(/\bclavulanic acid\b/g, 'clavulanate')
    .replace(/\b(hydrochloride|hcl|sodium|potassium|sulfate|sulphate|phosphate|maleate|mesylate|besylate|succinate|tartrate|dihydrate|monohydrate)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

// ── Quiet, background save of a condition's AI drug list ───────────────────
// Used for signed-in non-admin users: mirrors the admin "Save All" path
// (startConditionSave in AiInsightContext) — existing drugs get this
// condition's tag added (or flagged pending if their own indications don't
// support it), brand-new names get generated and saved — but with no
// progress state, no floating widget, and every failure swallowed. Nothing
// about this should ever be visible to the person it's running for.
export async function silentSaveConditionItems({ items, conditionId, conditionKeywords, existingByName, endpoint = '/api/drug-ai-details' }) {
  if (!Array.isArray(items) || items.length === 0 || !conditionId) return;
  for (const item of items) {
    try {
      const existing = existingByName.get(normalizeDrugNameForMatch(item.name));
      if (existing) {
        const relevant = drugMatchesConditionKeywords(existing, conditionKeywords, item.note);
        if (relevant === false) {
          await updateDoc(doc(db, 'drugs', existing.id || slugifyDrugName(item.name)), {
            pending_condition_tags: arrayUnion(conditionId),
            last_updated: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'drugs', existing.id || slugifyDrugName(item.name)), {
            condition_tags: arrayUnion(conditionId),
            last_updated: serverTimestamp(),
          });
        }
      } else {
        const drugClassForItem = item.subclass || undefined;
        const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: drugClassForItem, endpoint });
        const result = await saveAiDrugToDatabase({
          genericName: item.name, drugClass: drugClassForItem, text: itemText, overwrite: true,
        });
        if (result.status === 'saved') {
          await updateDoc(doc(db, 'drugs', result.id || slugifyDrugName(item.name)), {
            condition_tags: arrayUnion(conditionId),
          }).catch(() => {});
        }
      }
    } catch {
      // Intentionally silent — this must never surface to the user.
    }
    await new Promise(r => setTimeout(r, 350));
  }
}
