// ── aiSectionFill.js ──────────────────────────────────────────────────────
// Per-tab AI generation for the Drug Detail page. When a tab (Safety,
// Interactions, Pharmacology, Nursing, Dosage, Overview) is missing some or
// all of its information, this generates ONLY that tab's sections with AI,
// parses them, and saves just those fields onto the drug's Firestore record.
// ──────────────────────────────────────────────────────────────────────────

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { parseAiDrugDetail } from './parseAiDrugDetail';

async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save drug information.');
  }
  return auth.currentUser;
}

// For each tab: the drug-record fields it displays, and the exact ## headers
// to request from the AI (these MUST match parseAiDrugDetail's header map).
export const TAB_SECTIONS = {
  overview: {
    label:   'Overview',
    fields:  ['overview', 'indications', 'therapeutic_note'],
    headers: ['Overview', 'Indications', 'Therapeutic Note'],
  },
  dosage: {
    label:   'Dosage',
    fields:  ['adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations'],
    headers: ['Adult Dose', 'Child Dose', 'Renal Dose', 'Administration', 'NSTG Recommendations'],
  },
  safety: {
    label:   'Safety',
    fields:  ['pregnancy_lactation', 'contraindications', 'precautions', 'adverse_effect', 'advice_to_patients', 'pharmacovigilance'],
    headers: ['Pregnancy & Lactation', 'Contraindications', 'Precautions', 'Adverse Effects', 'Advice to Patients', 'Pharmacovigilance'],
  },
  interactions: {
    label:   'Interactions',
    fields:  ['interaction'],
    headers: ['Interactions'],
  },
  pharmacology: {
    label:   'Pharmacology',
    fields:  ['pharmacology', 'product_description', 'storage_recommendations', 'pack_size_price'],
    headers: ['Mechanism of Action & Pharmacology', 'Pharmacokinetics', 'Product Description', 'Storage Recommendations', 'Pack Size & Price'],
  },
  nursing: {
    label:   'Nursing Notes',
    fields:  ['nursing_action'],
    headers: ['Nursing Action'],
  },
};

// Which of this tab's fields are missing/empty on the drug record?
export function missingTabFields(drug, tabId) {
  const cfg = TAB_SECTIONS[tabId];
  if (!cfg || !drug) return [];
  return cfg.fields.filter(f => !(drug[f] && String(drug[f]).trim()));
}

// Fetch AI text for just this tab's sections (streamed as plain text).
export async function fetchAiSectionText({ genericName, drugClass, tabId }) {
  const cfg = TAB_SECTIONS[tabId];
  const res = await fetch('/api/drug-ai-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode:           'section',
      genericName,
      drugClass:      drugClass || undefined,
      sectionLabel:   cfg.label,
      sectionHeaders: cfg.headers,
    }),
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

// Generate this tab's sections, parse them, and save ONLY this tab's fields
// onto the drug record (merge — never touches other tabs' data). Returns the
// fields that were saved so the UI can update immediately.
export async function fillTabWithAi({ drug, tabId }) {
  await getAuthUser();
  const cfg = TAB_SECTIONS[tabId];
  if (!cfg) throw new Error(`Unknown tab: ${tabId}`);

  const text   = await fetchAiSectionText({
    genericName: drug.generic_name,
    drugClass:   drug.drug_class,
    tabId,
  });
  const parsed = parseAiDrugDetail(text);

  // Keep only this tab's fields that actually came back with content
  const updates = {};
  for (const f of cfg.fields) {
    if (parsed[f] && String(parsed[f]).trim()) updates[f] = parsed[f];
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('AI response could not be parsed into the expected sections. Try regenerating.');
  }

  // Merge-save onto the existing record. If this drug only exists as a local
  // seed entry (no Firestore doc yet), this creates a real record for it with
  // enough identity fields to be usable.
  await setDoc(doc(db, 'drugs', drug.id), {
    ...updates,
    generic_name: drug.generic_name,
    drug_class:   drug.drug_class || 'Unknown',
    source:       drug.source || 'AI Generated',
    status:       drug.status || 'Active',
    last_updated: serverTimestamp(),
  }, { merge: true });

  return updates;
}
