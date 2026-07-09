import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { parseAiDrugDetail } from './parseAiDrugDetail';
import { autoTagDrugConditions } from './autoTagConditions';

// Wait for Firebase Auth session to restore, then verify sign-in
async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save drugs.');
  }
  return auth.currentUser;
}

// Same deterministic-ID convention used by UploadPage.js's CSV import.
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

// ── Fetch AI text for a drug ──────────────────────────────────────────────
export async function fetchAiDrugText({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(endpoint, {
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
  return full;
}

// ── Fast, minimal-token strength-only lookup ──────────────────────────────
// Used when a drug already has all other required fields and only needs
// its formulation strength filled in — skips the full 20-field generation
// and only writes the single 'strength' field, so it's much faster/cheaper
// than a full regenerate + save.
export async function fetchStrengthText({ genericName, drugClass, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(endpoint, {
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
  return full;
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
  const res = await fetch(endpoint, {
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
  return full;
}

// ── Fetch AI-suggested drug list for a drug class ───────────────────────────
export async function fetchClassDrugList({ className, knownDrugNames, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(endpoint, {
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
  return full;
}

// ── Fetch AI-suggested additional conditions for a body system ─────────────
export async function fetchSystemConditionsList({ systemName, existingLabels, endpoint = '/api/drug-ai-details' }) {
  const res = await fetch(endpoint, {
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
  return full;
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
  await getAuthUser();
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
    // Patch — never touch existing data
    await updateDoc(ref, patch);
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

// ── Backwards-compatibility export ────────────────────────────────────────
// AiDrugPage and BrowsePage call this directly with pre-fetched text.
// We parse and validate here — only save if complete.
export async function saveAiDrugToDatabase({ genericName, drugClass, text, overwrite = true }) {
  await getAuthUser();
  const parsed    = parseAiDrugDetail(text);
  const missing   = getMissingGroups(parsed);
  const finalClass = drugClass || parsed.drug_class || 'Unknown';
  const docId     = slugifyDrugName(genericName);
  const ref       = doc(db, 'drugs', docId);

  // ALWAYS save AI search results — even if some fields are incomplete, and
  // even if a drug with this name already exists (it gets replaced).
  // Duplicate cleanup will be handled later via an admin duplicate detector.
  const existing = await getDoc(ref);
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
      ? (existing.data().created_at || serverTimestamp())
      : serverTimestamp(),
    last_updated: serverTimestamp(),
  }, { merge: false });

  // Auto-tag this drug onto any conditions whose keywords match its
  // indications — so a newly-searched drug shows up under the right
  // condition cards immediately, with no manual tagging step.
  await autoTagDrugConditions(docId, { ...parsed, generic_name: genericName });

  // Always 'saved'. missingGroups is informational only — never blocks saving.
  return { status: 'saved', id: docId, missingGroups: missing };
}
