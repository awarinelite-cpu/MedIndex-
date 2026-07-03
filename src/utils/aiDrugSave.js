import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { parseAiDrugDetail } from './parseAiDrugDetail';

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
export async function fetchAiDrugText({ genericName, drugClass }) {
  const res = await fetch('/api/drug-ai-details', {
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

// ── Generate, validate, and save a drug ──────────────────────────────────
// The drug is ONLY written to Firestore if ALL required field groups are
// present and non-trivial (>= MIN_LENGTH chars). If the first generation is
// incomplete, one automatic retry is attempted. Returns:
//   { status: 'saved' | 'skipped' | 'incomplete' | 'failed', id, missingGroups? }
export async function generateAndSaveIfComplete({
  genericName,
  drugClass,
  overwrite = false,
  onProgress,        // optional (msg: string) => void callback for live logs
}) {
  const log = (msg) => { if (onProgress) onProgress(msg); };
  const docId = slugifyDrugName(genericName);
  const ref   = doc(db, 'drugs', docId);

  // ── Skip fully-complete existing drugs ──────────────────────────────────
  if (!overwrite) {
    const existing = await getDoc(ref);
    if (existing.exists() && isDrugComplete(existing.data())) {
      log(`  ⏭ Skipped (already complete): ${genericName}`);
      return { status: 'skipped', id: docId };
    }
  }

  // ── Attempt 1 ────────────────────────────────────────────────────────────
  log(`  🤖 Generating: ${genericName}…`);
  let parsed;
  try {
    const text1 = await fetchAiDrugText({ genericName, drugClass });
    parsed = parseAiDrugDetail(text1);
  } catch (e) {
    return { status: 'failed', id: docId, error: e.message };
  }

  let missing = getMissingGroups(parsed);

  // ── Retry if incomplete ───────────────────────────────────────────────────
  if (missing.length > 0) {
    log(`  ⚠ Incomplete (${missing.map(g => g.label).join(', ')}) — retrying…`);
    try {
      const text2 = await fetchAiDrugText({ genericName, drugClass });
      const parsed2 = parseAiDrugDetail(text2);
      const missing2 = getMissingGroups(parsed2);
      if (missing2.length < missing.length) {
        // Retry was better — use it
        parsed  = parsed2;
        missing = missing2;
      }
    } catch {
      // Retry failed — continue with original attempt
    }
  }

  // ── Still incomplete after retry — do NOT save ────────────────────────────
  if (missing.length > 0) {
    log(`  ❌ Still incomplete after retry — NOT saved: ${genericName} (missing: ${missing.map(g => g.label).join(', ')})`);
    return { status: 'incomplete', id: docId, missingGroups: missing };
  }

  // ── All fields complete — save to Firestore ───────────────────────────────
  const existing = await getDoc(ref);
  const finalClass = drugClass || parsed.drug_class || 'Unknown';

  await setDoc(ref, {
    ...parsed,
    generic_name:        genericName,
    drug_class:          finalClass,
    drug_subclass:       parsed.drug_subclass   || null,
    prescription_status: parsed.prescription_status || 'Prescription',
    nafdac_no:           null,
    source:              'AI Generated',
    status:              'Active',
    created_at:  existing.exists() ? (existing.data().created_at || serverTimestamp()) : serverTimestamp(),
    last_updated: serverTimestamp(),
  }, { merge: false });

  log(`  ✅ Saved (complete): ${genericName}`);
  return { status: 'saved', id: docId };
}
