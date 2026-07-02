import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { parseAiDrugDetail } from './parseAiDrugDetail';

// Same deterministic-ID convention used by UploadPage.js's CSV import, so an
// AI-saved drug and a later CSV upload of the same generic name land on the
// same document instead of duplicating.
export function slugifyDrugName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

// Runs the single-drug AI lookup and returns the full response text.
// Properly reads the streaming response chunk-by-chunk so no data is lost.
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

  // Read the stream chunk-by-chunk (same pattern used in BrowsePage UI)
  const reader = res.body.getReader();
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

// Parses an AI drug-lookup response and writes it to Firestore under the
// deterministic slug ID. Set overwrite:true to replace an existing entry;
// otherwise an existing entry is left untouched and 'skipped' is returned.
export async function saveAiDrugToDatabase({ genericName, drugClass, text, overwrite = false }) {
  const parsed = parseAiDrugDetail(text);

  // Use caller-supplied drugClass as primary source — never block on missing parsed class
  const finalClass = drugClass || parsed.drug_class || 'Unknown';

  const docId = slugifyDrugName(genericName);
  const ref = doc(db, 'drugs', docId);
  const existing = await getDoc(ref);

  if (existing.exists() && !overwrite) {
    return { status: 'skipped', id: docId };
  }

  await setDoc(ref, {
    ...parsed,
    generic_name:        genericName,
    drug_class:          finalClass,
    drug_subclass:       parsed.drug_subclass || null,
    prescription_status: parsed.prescription_status || 'Prescription',
    nafdac_no:           null,
    source:              'AI Generated',
    status:              'Active',
    created_at:          existing.exists() ? (existing.data().created_at || serverTimestamp()) : serverTimestamp(),
    last_updated:        serverTimestamp(),
  }, { merge: false });

  return { status: 'saved', id: docId };
}
