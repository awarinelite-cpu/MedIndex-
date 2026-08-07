// src/utils/clinicalPlan.js
//
// Client for the shared "clinical_plan" mode on /api/drug-ai-details — the
// same clinical decision-support engine NACON-EMR's patient consultation
// screen uses (src/lib/geminiInsights.js there), now callable from MedIndex
// too so the two apps share one canonical prompt instead of drifting apart.
//
// Grounding here uses MedIndex's OWN live drug list (from useDrugs()) —
// no cross-app Firestore read needed, since MedIndex already IS the
// formulary. The relevance-scoring approach mirrors NACON-EMR's
// src/lib/medIndex.js findRelevantMedIndexDrugs() so both apps ground the
// AI the same way, and dedupes by generic_name for the same reason that
// fix was needed there: an ungrouped list of near-identical formulary
// records gets echoed back as if each were a distinct option.

import { apiUrl } from '../config/apiBase';
import { parseAllergyList, filterAllergicDrugs } from './allergyGuard';

function scoreDrug(drug, keywords) {
  const haystack = [drug.generic_name, drug.drug_class, drug.drug_subclass, drug.primary_indications, drug.indications, drug.overview]
    .filter(Boolean).join(' ').toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 4) continue;
    if (haystack.includes(kw)) score++;
  }
  return score;
}

// Best-effort keyword match against the note + diagnosis, so the prompt
// only carries the handful of plausibly-relevant drugs instead of the
// whole formulary. Dedupes by generic_name — see module comment above.
export function findRelevantDrugs(drugs, { noteText, primaryDiagnosis }, limit = 25) {
  if (!Array.isArray(drugs) || !drugs.length) return [];
  const text = `${noteText || ''} ${primaryDiagnosis || ''}`.toLowerCase();
  const keywords = Array.from(new Set(text.split(/[^a-z0-9]+/).filter(Boolean)));
  const ranked = drugs
    .map(d => ({ d, score: scoreDrug(d, keywords) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const seenNames = new Set();
  const deduped = [];
  for (const { d } of ranked) {
    const key = (d.generic_name || '').trim().toLowerCase();
    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);
    deduped.push(d);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

// Exact/near lookup by generic name — used to enrich a drug the AI already
// suggested with MedIndex's own record (drug_class) for the client-side
// allergy re-check, exactly as NACON-EMR's lookupMedIndexDrug does.
export function lookupDrugByName(drugs, name) {
  if (!name || !Array.isArray(drugs)) return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;
  return (
    drugs.find(d => (d.generic_name || '').trim().toLowerCase() === target) ||
    drugs.find(d => {
      const gn = (d.generic_name || '').trim().toLowerCase();
      return gn && (gn.includes(target) || target.includes(gn));
    }) ||
    null
  );
}

/**
 * Ask the shared clinical-plan engine for a Diagnosis + Main/Adjunct/
 * Combination Therapy management plan, grounded in MedIndex's own live
 * drug list. Streams the response and resolves once it's complete.
 *
 * @param {Object} params
 * @param {string} params.noteText          - free-text complaint/consultation note
 * @param {string} [params.allergies]       - free-text allergy field, e.g. "Penicillin, NSAIDs"
 * @param {string} [params.primaryDiagnosis]
 * @param {number} [params.age]
 * @param {string} [params.sex]
 * @param {Array}  params.drugs             - live drug list from useDrugs()
 * @returns {Promise<{ text: string }>}
 */
export async function getClinicalPlan({ noteText, allergies, primaryDiagnosis, age, sex, drugs }) {
  if (!noteText || !noteText.trim()) {
    throw new Error('Describe the complaint/consultation note first.');
  }

  const allergyList = parseAllergyList(allergies);
  const medIndexDrugsRaw = findRelevantDrugs(drugs, { noteText, primaryDiagnosis }, 25);
  const { safe: medIndexDrugs, excluded: medIndexExcluded } = filterAllergicDrugs(medIndexDrugsRaw, allergies);

  const res = await fetch(apiUrl('/api/drug-ai-details'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'clinical_plan',
      noteText,
      age,
      sex,
      primaryDiagnosis,
      allergyList,
      medIndexDrugs: medIndexDrugs.map(d => ({
        generic_name: d.generic_name,
        drug_class: d.drug_class,
        dosage: d.dosage,
        primary_indications: d.primary_indications || d.indications,
        contraindications: d.contraindications,
      })),
      medIndexExcluded: medIndexExcluded.map(d => ({ generic_name: d.generic_name })),
    }),
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch {}
    throw new Error(detail || `AI request failed (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text = text.trim();
  if (!text) throw new Error('AI returned an empty response. Try again.');
  if (text.startsWith('[') && /error/i.test(text.slice(0, 40))) {
    throw new Error(text.replace(/^\[|\]$/g, ''));
  }
  return { text };
}
