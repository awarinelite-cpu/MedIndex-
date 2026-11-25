// ── /api/indication-check ─────────────────────────────────────────────────
// Node.js serverless function (needs firebase-admin for the admin check, so
// no `edge` runtime). NO AI: it compares each drug with free, official
// reference data and reports whether the drug looks indicated for a condition.
//
//   POST { drugs: [{ id, name }], condition: { label, keywords?: string[] },
//          candidates?: [{ id, label, keywords?: string[] }] }
//   →    { results: [{ id, name, status, matchedBy, concept, excerpt,
//                      rxConditions, suggestions: [{ id, label, concept }] }] }
//
// status: 'match'   – found in the label's Indications & Usage (openFDA) or in
//                     RxClass "may treat / may prevent" for the condition
//         'nomatch' – reference data found, but nothing mentions the condition
//         'nodata'  – neither source knows this drug name
// `candidates` are other conditions the drug could be moved to; any whose
// concepts match the drug's reference text come back as `suggestions`.
//
// Requires a valid signed-in Firebase ID token (`Authorization: Bearer …`).
// Nothing here reads or writes Firestore.
// ──────────────────────────────────────────────────────────────────────────

import { buildConcepts, findMatch, stripSalt } from './_lib/indicationMatch.js';

const FETCH_TIMEOUT_MS = 6000;
const MAX_DRUGS = 12;
const CONCURRENCY = 4;

async function fetchJson(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function labelIndications(name, getJson) {
  const tryField = async (field, value) => {
    const q = encodeURIComponent(`openfda.${field}:"${value}"`);
    const data = await getJson(`https://api.fda.gov/drug/label.json?search=${q}&limit=3`);
    const texts = (data?.results || [])
      .map((r) => [r.indications_and_usage, r.purpose, r.indications_and_usage_table].flat().filter(Boolean).join(' '))
      .filter(Boolean);
    return texts.length ? texts.map((t) => t.slice(0, 5000)).join(' ') : '';
  };
  const names = [...new Set([name, stripSalt(name)])];
  for (const n of names) {
    for (const field of ['generic_name', 'substance_name']) {
      const text = await tryField(field, n);
      if (text) return text;
    }
  }
  return '';
}

async function rxClassConditions(name, getJson) {
  const out = new Set();
  const names = [...new Set([name, stripSalt(name)])];
  for (const n of names) {
    for (const rela of ['may_treat', 'may_prevent']) {
      const data = await getJson(
        `https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json?drugName=${encodeURIComponent(n)}&relaSource=MEDRT&relas=${rela}`
      );
      (data?.rxclassDrugInfoList?.rxclassDrugInfo || []).forEach((i) => {
        const c = i?.rxclassMinConceptItem?.className;
        if (c) out.add(c);
      });
    }
    if (out.size) break;
  }
  return [...out];
}

export async function checkDrug(drug, concepts, candidateConcepts, getJson = fetchJson) {
  const name = String(drug?.name || '').trim();
  const base = { id: drug?.id, name };
  if (!name) return { ...base, status: 'nodata', suggestions: [] };

  const [label, rx] = await Promise.all([
    labelIndications(name, getJson).catch(() => ''),
    rxClassConditions(name, getJson).catch(() => []),
  ]);
  const rxText = rx.join('. ');

  if (!label && !rx.length) return { ...base, status: 'nodata', suggestions: [] };

  const fromLabel = findMatch(concepts, label);
  const fromRx = fromLabel ? null : findMatch(concepts, rxText);
  const hit = fromLabel || fromRx;
  if (hit) {
    return {
      ...base,
      status: 'match',
      matchedBy: fromLabel ? 'label' : 'rxclass',
      concept: hit.concept,
      excerpt: hit.excerpt,
      rxConditions: rx.slice(0, 8),
      suggestions: [],
    };
  }

  const suggestions = [];
  for (const c of candidateConcepts) {
    const m = findMatch(c.concepts, label) || findMatch(c.concepts, rxText);
    if (m) suggestions.push({ id: c.id, label: c.label, concept: m.concept });
    if (suggestions.length >= 4) break;
  }
  return {
    ...base,
    status: 'nomatch',
    excerpt: label ? label.replace(/\s+/g, ' ').trim().slice(0, 220) + (label.length > 220 ? '…' : '') : '',
    rxConditions: rx.slice(0, 8),
    suggestions,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  try {
    let firebaseAdmin;
    try {
      firebaseAdmin = await import('./_lib/firebaseAdmin.js');
    } catch (e) {
      res.status(500).json({ error: 'Failed to load the Admin SDK module: ' + (e?.message || String(e)) });
      return;
    }
    // Only the sign-in token is verified here (no Firestore read), so this keeps
    // working when the project's daily Firestore quota is used up. The endpoint
    // returns public drug-label data and writes nothing; the button is admin-only
    // in the app and every change is still enforced by the Firestore rules.
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) { res.status(401).json({ error: 'Missing Authorization header — please sign in.' }); return; }
      try {
        await firebaseAdmin.adminAuth().verifyIdToken(token);
      } catch {
        res.status(401).json({ error: 'Invalid or expired session — please sign in again.' });
        return;
      }
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const drugs = Array.isArray(body.drugs) ? body.drugs.slice(0, MAX_DRUGS) : [];
    const label = String(body.condition?.label || '').trim();
    if (!drugs.length || !label) {
      res.status(400).json({ error: 'Send { drugs: [{id,name}], condition: { label } }.' });
      return;
    }

    const concepts = buildConcepts(label, body.condition?.keywords || []);
    if (!concepts.length) {
      res.status(400).json({ error: 'Could not read any keywords from the condition name. Add extra keywords and try again.' });
      return;
    }
    const candidateConcepts = (Array.isArray(body.candidates) ? body.candidates : [])
      .slice(0, 60)
      .map((c) => ({ id: c.id, label: c.label, concepts: buildConcepts(c.label, c.keywords || []) }))
      .filter((c) => c.id && c.concepts.length);

    const results = new Array(drugs.length);
    let next = 0;
    const worker = async () => {
      while (next < drugs.length) {
        const i = next++;
        try {
          results[i] = await checkDrug(drugs[i], concepts, candidateConcepts);
        } catch (e) {
          results[i] = { id: drugs[i]?.id, name: drugs[i]?.name, status: 'nodata', suggestions: [], error: String(e?.message || e) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, drugs.length) }, worker));

    res.status(200).json({ results, concepts: concepts.map((c) => c.text) });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Indication check failed.' });
  }
}
