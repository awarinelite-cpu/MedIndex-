// src/utils/localDrugInteractions.js
//
// Database-driven drug interaction / combination engine.
//
// Everything here works ONLY from the drug records already stored in the
// system — no AI, no network. It reads each drug's:
//   Contraindications · Precautions · Pharmacology · Adverse Effects ·
//   Nursing Action  (plus the stored Interactions and Administration text)
// and looks for:
//   1. Direct mentions — one drug's text naming the other drug (generic or
//      brand name) or the other drug's class ("avoid with MAO inhibitors").
//   2. Overlapping risks — both drugs carrying the same significant risk
//      (QT prolongation, bleeding, serotonin syndrome, CNS/respiratory
//      depression, hyperkalaemia, nephrotoxicity, ...).
//   3. Enzyme (CYP) conflicts — one drug inhibits/induces an enzyme the
//      other is metabolised by.
//   4. Verified classic contraindications (e.g. ceftriaxone + calcium).
//
// The UI layers AI results on top of this, never instead of it: if the AI
// is down, these results still show.

// ── Stored sections we search ────────────────────────────────────────────
export const SECTIONS = [
  { key: 'contraindications', label: 'Contraindications', fields: ['contraindications'] },
  { key: 'precautions',       label: 'Precautions',       fields: ['precautions', 'warnings'] },
  { key: 'interaction',       label: 'Interactions',      fields: ['interaction', 'drug_interactions'] },
  { key: 'adverse',           label: 'Adverse Effects',   fields: ['adverse_effect', 'side_effects'] },
  { key: 'nursing',           label: 'Nursing Action',    fields: ['nursing_action', 'nursing_considerations'] },
  { key: 'pharmacology',      label: 'Pharmacology',      fields: ['pharmacology', 'mechanism'] },
  { key: 'administration',    label: 'Administration',    fields: ['administration'] },
];

// The five areas a verdict of "nothing found" must be backed by.
const CORE_KEYS = ['contraindications', 'precautions', 'pharmacology', 'adverse', 'nursing'];
const MIN_SECTION_CHARS = 30;

// Sections used to discover combination-therapy partners.
const COMBO_FIELDS = [
  ['Overview', ['overview']],
  ['Indications', ['indications', 'primary_indications']],
  ['Therapeutic Note', ['therapeutic_note']],
  ['NSTG Recommendations', ['nstg_recommendations']],
  ['Dosage', ['adult_dose', 'dosage']],
  ['Off-label Use', ['off_label_use']],
  ['Nursing Action', ['nursing_action', 'nursing_considerations']],
];

// ── Text helpers ─────────────────────────────────────────────────────────
function fieldText(drug, fields) {
  for (const f of fields) {
    const v = drug?.[f];
    if (v && String(v).trim().length > 0) return String(v);
  }
  return '';
}

function splitSentences(text) {
  if (!text) return [];
  const protectedText = String(text)
    .replace(/\be\.g\./gi, 'e_g_')
    .replace(/\bi\.e\./gi, 'i_e_')
    .replace(/\bvs\./gi, 'vs_')
    .replace(/\bapprox\./gi, 'approx_');
  const out = [];
  protectedText.split(/\n+/).forEach(line => {
    const clean = line.replace(/^[\s\-•*·]+/, '').trim();
    if (!clean) return;
    (clean.match(/[^.;!?]+[.;!?]?/g) || [clean]).forEach(s => {
      const t = s.replace(/e_g_/g, 'e.g.').replace(/i_e_/g, 'i.e.').replace(/vs_/g, 'vs.').replace(/approx_/g, 'approx.').trim();
      if (t.length >= 6) out.push(t);
    });
  });
  return out;
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimQuote(s, max = 240) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function norm(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Class lexicon ────────────────────────────────────────────────────────
// mention: how a class is written inside monograph text.
// member:  how to recognise that a drug belongs to the class from its stored
//          drug_class / drug_subclass / name.
const CLASS_LEXICON = [
  { name: 'NSAIDs', mention: /\bnsaids?\b|non-?steroidal anti-?inflammator/i, member: /nsaid|non-?steroidal anti|cox-?2/i },
  { name: 'MAO inhibitors', mention: /\bmao-?i?s?\b|monoamine oxidase inhibitor/i, member: /monoamine oxidase|\bmao/i },
  { name: 'Benzodiazepines', mention: /benzodiazepine/i, member: /benzodiazepine/i },
  { name: 'Opioids', mention: /opioid|opiate|narcotic/i, member: /opioid|opiate|narcotic/i },
  { name: 'Anticoagulants', mention: /anticoagulant|blood thinner/i, member: /anticoagulant/i },
  { name: 'Antiplatelets', mention: /antiplatelet|platelet aggregation inhibitor/i, member: /antiplatelet/i },
  { name: 'ACE inhibitors', mention: /\bace[- ]?inhibitor|angiotensin[- ]converting/i, member: /\bace[- ]?inhibitor|angiotensin[- ]converting/i },
  { name: 'ARBs', mention: /\barbs?\b|angiotensin (ii )?receptor (blocker|antagonist)/i, member: /angiotensin (ii )?receptor|\barb\b/i },
  { name: 'Beta-blockers', mention: /beta[- ]?(adrenergic )?(blocker|blocking|antagonist)/i, member: /beta[- ]?(adrenergic )?(blocker|blocking|antagonist)/i },
  { name: 'Calcium channel blockers', mention: /calcium[- ]channel (blocker|antagonist)|\bccbs?\b/i, member: /calcium[- ]channel/i },
  { name: 'Diuretics', mention: /diuretic/i, member: /diuretic/i },
  { name: 'Potassium-sparing diuretics', mention: /potassium[- ]sparing/i, member: /potassium[- ]sparing/i },
  { name: 'Potassium supplements', mention: /potassium (supplement|salt|chloride)|potassium-containing/i, member: /potassium (supplement|chloride)/i },
  { name: 'Corticosteroids', mention: /corticosteroid|glucocorticoid|\bsteroids?\b/i, member: /corticosteroid|glucocorticoid|steroid/i },
  { name: 'Antipsychotics', mention: /antipsychotic|neuroleptic/i, member: /antipsychotic|neuroleptic/i },
  { name: 'Antidepressants', mention: /antidepressant/i, member: /antidepressant/i },
  { name: 'SSRIs', mention: /\bssris?\b|selective serotonin reuptake/i, member: /\bssri|selective serotonin reuptake/i },
  { name: 'Tricyclic antidepressants', mention: /tricyclic|\btcas?\b/i, member: /tricyclic/i },
  { name: 'Anticonvulsants', mention: /anticonvulsant|antiepileptic/i, member: /anticonvulsant|antiepileptic/i },
  { name: 'Macrolides', mention: /macrolide/i, member: /macrolide/i },
  { name: 'Fluoroquinolones', mention: /fluoroquinolone|quinolone/i, member: /quinolone/i },
  { name: 'Aminoglycosides', mention: /aminoglycoside/i, member: /aminoglycoside/i },
  { name: 'Azole antifungals', mention: /azole antifungal|\bazoles?\b/i, member: /azole/i },
  { name: 'Antacids', mention: /antacid/i, member: /antacid/i },
  { name: 'Anticholinergics', mention: /anticholinergic|antimuscarinic/i, member: /anticholinergic|antimuscarinic/i },
  { name: 'Antihypertensives', mention: /antihypertensive/i, member: /antihypertensive/i },
  { name: 'Antidiabetic agents', mention: /antidiabetic|hypoglyc[a]?emic (agent|drug)|oral hypoglyc/i, member: /antidiabetic|hypoglyc[a]?emic|sulphonylurea|sulfonylurea|biguanide/i },
  { name: 'Nitrates', mention: /\bnitrates?\b/i, member: /\bnitrate/i },
  { name: 'PDE-5 inhibitors', mention: /pde-?5|phosphodiesterase[- ]?5/i, member: /pde-?5|phosphodiesterase[- ]?5/i },
  { name: 'Sedatives / CNS depressants', mention: /cns depressants?|sedative|hypnotic|central nervous system depressant/i, member: /sedative|hypnotic|anxiolytic|benzodiazepine|barbiturate|opioid/i },
  { name: 'QT-prolonging drugs', mention: /qt[- ]?(interval )?prolong|prolong\w* (the )?qt|torsades/i, member: /$^/ },
  { name: 'Live vaccines', mention: /live (attenuated )?vaccine/i, member: /live .*vaccine/i },
  { name: 'Penicillins', mention: /penicillin/i, member: /penicillin/i },
  { name: 'Cephalosporins', mention: /cephalosporin/i, member: /cephalosporin/i },
  { name: 'Antiretrovirals', mention: /antiretroviral/i, member: /antiretroviral|protease inhibitor|nnrti|nrti/i },
  { name: 'Antiemetics', mention: /antiemetic/i, member: /antiemetic/i },
  { name: 'Statins', mention: /\bstatins?\b/i, member: /statin/i },
  { name: 'Oral contraceptives', mention: /oral contraceptive|hormonal contraceptive/i, member: /contraceptive/i },
];

// ── Shared risk tags (pharmacodynamic overlap) ───────────────────────────
const RISK_TAGS = [
  { key: 'qt', label: 'QT-interval prolongation', re: /qt[- ]?(interval|c)?\s*prolong|prolong\w*\s+(of\s+)?(the\s+)?qt|torsades|ventricular arrhythmia/i,
    effect: 'Both drugs can prolong the QT interval, so combining them adds to the risk of dangerous heart-rhythm disturbances (e.g. torsades de pointes).' },
  { key: 'serotonin', label: 'Serotonin syndrome', re: /serotonin syndrome|serotonergic/i,
    effect: 'Both drugs raise serotonin activity; together they increase the risk of serotonin syndrome (agitation, hyperthermia, tremor, tachycardia).' },
  { key: 'bleeding', label: 'Bleeding', re: /bleeding|haemorrhage|hemorrhage|antiplatelet|anticoagulant effect/i,
    effect: 'Both drugs can increase bleeding risk, so the combined risk of haemorrhage is higher.' },
  { key: 'cns_resp', label: 'CNS / respiratory depression', re: /respiratory depression|cns depress|central nervous system depress|profound sedation/i,
    effect: 'Both drugs can depress the central nervous system or breathing; together the sedation and respiratory depression can be additive.' },
  { key: 'hyperk', label: 'Hyperkalaemia', re: /hyperkal[a]?emia|raised potassium|elevated potassium|increase[sd]? (serum )?potassium/i,
    effect: 'Both drugs can raise serum potassium, increasing the risk of hyperkalaemia and cardiac arrhythmia.' },
  { key: 'nephro', label: 'Nephrotoxicity', re: /nephrotox|renal (toxicity|impairment|failure|damage)|kidney (damage|injury|failure)|acute kidney/i,
    effect: 'Both drugs can harm the kidneys; combined use raises the risk of renal toxicity.' },
  { key: 'oto', label: 'Ototoxicity', re: /ototox|hearing loss|tinnitus/i,
    effect: 'Both drugs can damage hearing or balance; combined use increases ototoxicity risk.' },
];

// Sections where a risk tag counts as "this drug carries that risk".
const RISK_SECTION_KEYS = new Set(['adverse', 'precautions', 'interaction', 'nursing', 'contraindications']);
const RARE_OR_NEGATED = /\b(rare(ly)?|uncommon|unlikely|does not|doesn'?t|no (significant )?(risk|effect)|low risk|not associated|minimal|less than|lower than|fewer)\b/i;
const ADVERSE_RISK_CUE = /\b(severe|serious|major|life-?threatening|fatal|significant|risk|dose-?dependent|may|can|prolong\w*|syndrome)\b/i;

// ── Verified classic contraindications (mirrors the server-side list) ────
const ABSOLUTE_RULES = [
  {
    a: ['ceftriaxone', 'rocephin'],
    b: ['ringerslactate', 'lactatedringer', 'hartmann', 'calciumgluconate', 'calciumchloride', 'calcium'],
    mechanism: 'Ceftriaxone forms an insoluble calcium\u2013ceftriaxone precipitate when mixed with, or given through the same IV line as, any calcium-containing solution (including Ringer\'s Lactate / Hartmann\'s).',
    effect: 'The precipitate can lodge in the lungs and kidneys and has caused fatalities in neonates.',
    recommendation: 'Do NOT mix or co-infuse through the same line. In neonates (28 days or younger) do not give together at all.',
  },
];

// ── Per-drug profile (cached) ────────────────────────────────────────────
const profileCache = new WeakMap();

const GENERIC_FIRST_WORD_STOP = new Set([
  'sodium', 'potassium', 'calcium', 'magnesium', 'vitamin', 'insulin', 'iron', 'zinc', 'water', 'normal',
  'dextrose', 'glucose', 'sterile', 'hydrogen', 'folic', 'ascorbic', 'oral', 'compound', 'sulfate', 'sulphate',
]);

function buildNameTerms(drug) {
  const raw = [];
  const generic = String(drug.generic_name || '');
  raw.push(generic);
  raw.push(generic.replace(/\(.*?\)/g, ' '));
  (generic.match(/\(([^)]+)\)/g) || []).forEach(m => raw.push(m.replace(/[()]/g, '')));
  String(drug.brand_names || '').split(/[,;/]/).forEach(b => raw.push(b));

  const terms = new Set();
  raw.forEach(r => {
    const t = r.toLowerCase().replace(/\s+/g, ' ').trim();
    if (t.length >= 4) terms.add(t);
  });
  // First word of a multi-word generic ("Amoxicillin / Clavulanate" → amoxicillin)
  generic.toLowerCase().split(/[\s/+,-]+/).forEach(w => {
    if (w.length >= 6 && !GENERIC_FIRST_WORD_STOP.has(w) && !/^\d/.test(w)) terms.add(w);
  });
  return [...terms];
}

function buildNameRegexes(terms) {
  return terms.map(t => new RegExp('(^|[^a-z0-9])' + esc(t) + 's?(?![a-z0-9])', 'i'));
}

function buildProfile(drug) {
  const sections = SECTIONS.map(sec => {
    const text = fieldText(drug, sec.fields);
    const sentences = splitSentences(text).map(t => ({ text: t, lower: t.toLowerCase() }));
    return { key: sec.key, label: sec.label, text, sentences, present: text.trim().length >= MIN_SECTION_CHARS };
  });

  const nameTerms = buildNameTerms(drug);
  const classText = `${drug.drug_class || ''} ${drug.drug_subclass || ''}`.toLowerCase();

  const memberOf = new Set();
  CLASS_LEXICON.forEach(c => {
    if (c.member.test(classText) || c.member.test(String(drug.generic_name || ''))) memberOf.add(c.name);
  });

  // Free-text class phrases (e.g. "Benzodiazepine", "Loop diuretic")
  const classPhrases = classText
    .split(/[/,;&]| and /)
    .map(s => s.replace(/\b(agents?|drugs?|medications?|group|class)\b/g, '').replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 6)
    .map(s => s.replace(/s$/, ''));

  // Risk tags + CYP roles, taken only from the risk-bearing sections
  const risks = new Map(); // tag key → first matching sentence + section
  const cyp = { inhibits: new Set(), induces: new Set(), substrate: new Set() };
  sections.forEach(sec => {
    sec.sentences.forEach(s => {
      if (RISK_SECTION_KEYS.has(sec.key)) {
        RISK_TAGS.forEach(tag => {
          if (risks.has(tag.key) || !tag.re.test(s.text)) return;
          if (RARE_OR_NEGATED.test(s.text)) return;
          if (sec.key === 'adverse' && !ADVERSE_RISK_CUE.test(s.text)) return;
          risks.set(tag.key, { section: sec.label, text: s.text });
        });
      }
      if (sec.key === 'pharmacology' || sec.key === 'interaction' || sec.key === 'precautions' || sec.key === 'nursing') {
        const ids = [...s.lower.matchAll(/cyp\s?-?(\d[a-z]\d{1,2})/g)].map(m => m[1]);
        if (ids.length) {
          ids.forEach(id => {
            if (/inhibit/.test(s.lower)) cyp.inhibits.add(id);
            if (/induc/.test(s.lower)) cyp.induces.add(id);
            if (/substrate|metaboli[sz]ed|metabolism/.test(s.lower)) cyp.substrate.add(id);
          });
        }
      }
    });
  });

  const present = new Set(sections.filter(s => s.present).map(s => s.key));
  const missingCore = CORE_KEYS.filter(k => !present.has(k));
  const coreCount = CORE_KEYS.length - missingCore.length;

  return {
    drug,
    sections,
    nameTerms,
    nameRegexes: buildNameRegexes(nameTerms),
    classText,
    classPhrases,
    memberOf,
    risks,
    cyp,
    missingCore,
    // Enough stored data for "nothing found" to mean something.
    sufficient: coreCount >= 4 && present.has('contraindications'),
  };
}

function profileOf(drug) {
  if (!drug || typeof drug !== 'object') return buildProfile({});
  let p = profileCache.get(drug);
  if (!p) {
    p = buildProfile(drug);
    profileCache.set(drug, p);
  }
  return p;
}

export function getMissingCoreSections(drug) {
  const labelByKey = Object.fromEntries(SECTIONS.map(s => [s.key, s.label]));
  return profileOf(drug).missingCore.map(k => labelByKey[k]);
}

// ── Sentence classification ──────────────────────────────────────────────
const STRONG = /\b(contra-?indicated|must not|do not|does not|should not|never|avoid(ed|ance)?|not (be )?(recommended|used|given|administered|combined|co-?administered|mixed)|prohibited|life-?threatening|fatal|dangerous)\b/i;
const CAUTION = /\b(caution|monitor|careful|may (increase|decrease|enhance|potentiate|reduce|prolong|cause|inhibit|induce)|increase[sd]?|decrease[sd]?|reduce[sd]?|enhance[sd]?|potentiat\w*|additive|synergis\w*|toxicity|interact\w*|dose (adjust\w*|reduction)|separate|antagoni[sz]e\w*|raise[sd]?|lower\w*)\b/i;
const COMBINED_USE = /(concomitant|concurrent|combin|co-?admin|together|simultaneous|same (iv )?(line|syringe|bag|infusion)|\bmix|\badmix|\bwith\b)/i;
const ALLERGY_ONLY = /(hypersensitiv|allerg|anaphyla|angioedema|sensitivity to)/i;
// Comparisons / switching advice are not interactions ("less than diazepam", "same as warfarin").
const COMPARATIVE = /\b(less than|more than|greater than|higher than|lower than|compared (to|with)|versus|vs\.?|superior|inferior|similar to|same as|unlike|alternative to|switch(ing)? (from|to)|convert(ing)? (from|to)|equivalent|instead of|different (site|from)|distinct from|than)\b/i;
// Outside Contraindications / Interactions a mention only counts if it is
// phrased as a combined-use warning.
const INTERACTION_CUE = /(concomitant|concurrent|co-?admin|combin|together|simultaneous|interact|potentiat|enhanc|additive|synerg|avoid|with other|(patients|those) (taking|receiving|on)|taking|receiving|when (given|used|taken|combined)|(used|given|taken|administered|combined|mixed|diluted) with|increase[sd]? (the )?(effect|risk|level|concentration|toxicity)|reduce[sd]? (the )?(effect|efficacy|level|absorption)|do not|must not|should not|contra-?indicated)/i;

function severityFor(sectionKey, sentenceText) {
  const strong = STRONG.test(sentenceText);
  if (sectionKey === 'contraindications') {
    return 'contraindicated';
  }
  if (sectionKey === 'interaction' || sectionKey === 'administration') {
    return strong ? 'contraindicated' : 'monitor';
  }
  if (sectionKey === 'precautions' || sectionKey === 'nursing') {
    return strong && COMBINED_USE.test(sentenceText) ? 'contraindicated' : 'monitor';
  }
  // adverse / pharmacology — a mention here is a warning, not a prohibition
  return 'monitor';
}

const RANK = { contraindicated: 3, monitor: 2, safe: 1, unknown: 0 };
const maxSeverity = (a, b) => (RANK[a] >= RANK[b] ? a : b);

// ── Direct mentions: does `src`'s stored text name `tgt` (or its class)? ──
function mentionHits(src, tgt) {
  const hits = [];
  const srcName = String(src.drug.generic_name || '');

  src.sections.forEach(sec => {
    sec.sentences.forEach(s => {
      if (ALLERGY_ONLY.test(s.text) && sec.key === 'contraindications') return;
      if (COMPARATIVE.test(s.text)) return;
      if (sec.key !== 'contraindications' && sec.key !== 'interaction' && !INTERACTION_CUE.test(s.text)) return;

      // 1. Named directly (generic or brand)
      if (tgt.nameRegexes.some(re => re.test(s.text))) {
        hits.push({
          kind: 'name', via: tgt.drug.generic_name,
          drug: srcName, section: sec.label, sectionKey: sec.key, text: s.text,
          severity: severityFor(sec.key, s.text),
        });
        return;
      }

      // 2. Named by class (lexicon)
      for (const cls of CLASS_LEXICON) {
        if (!tgt.memberOf.has(cls.name)) continue;
        if (src.memberOf.has(cls.name)) continue; // a drug's own class isn't a partner
        if (cls.mention.test(s.text)) {
          hits.push({
            kind: 'class', via: cls.name,
            drug: srcName, section: sec.label, sectionKey: sec.key, text: s.text,
            severity: severityFor(sec.key, s.text),
          });
          return;
        }
      }

      // 3. Named by the target's own stored class phrase
      for (const phrase of tgt.classPhrases) {
        if (src.classPhrases.includes(phrase) || src.classText.includes(phrase)) continue;
        if (s.lower.includes(phrase)) {
          hits.push({
            kind: 'class', via: tgt.drug.drug_class || phrase,
            drug: srcName, section: sec.label, sectionKey: sec.key, text: s.text,
            severity: severityFor(sec.key, s.text),
          });
          return;
        }
      }
    });
  });
  return hits;
}

function overlapFindings(a, b) {
  const out = [];
  RISK_TAGS.forEach(tag => {
    const ra = a.risks.get(tag.key);
    const rb = b.risks.get(tag.key);
    if (ra && rb) {
      out.push({
        kind: 'overlap', tag: tag.key, label: tag.label, effect: tag.effect,
        evidence: [
          { drug: a.drug.generic_name, section: ra.section, text: ra.text },
          { drug: b.drug.generic_name, section: rb.section, text: rb.text },
        ],
      });
    }
  });
  return out;
}

function cypFindings(a, b) {
  const out = [];
  const check = (x, y) => {
    [...x.cyp.inhibits].forEach(id => {
      if (y.cyp.substrate.has(id)) {
        out.push({ kind: 'cyp', text: `${x.drug.generic_name} inhibits CYP${id.toUpperCase()}, an enzyme that metabolises ${y.drug.generic_name}, so ${y.drug.generic_name} levels may rise.` });
      }
    });
    [...x.cyp.induces].forEach(id => {
      if (y.cyp.substrate.has(id)) {
        out.push({ kind: 'cyp', text: `${x.drug.generic_name} induces CYP${id.toUpperCase()}, an enzyme that metabolises ${y.drug.generic_name}, so ${y.drug.generic_name} levels may fall.` });
      }
    });
  };
  check(a, b);
  check(b, a);
  // de-dupe
  return out.filter((f, i) => out.findIndex(o => o.text === f.text) === i);
}

function absoluteRule(nameA, nameB) {
  const A = norm(nameA), B = norm(nameB);
  for (const r of ABSOLUTE_RULES) {
    const aA = r.a.some(t => A.includes(t)), bB = r.b.some(t => B.includes(t));
    const aB = r.a.some(t => B.includes(t)), bA = r.b.some(t => A.includes(t));
    if ((aA && bB) || (aB && bA)) return r;
  }
  return null;
}

// ── Pair analysis ────────────────────────────────────────────────────────
const REC = {
  contraindicated: 'Avoid this combination unless the prescriber has specifically weighed the risk. Check both full monographs before giving.',
  monitor: 'Use with caution. Monitor the patient for the effects described and confirm dose and timing with the prescriber or pharmacist.',
};

/**
 * Analyse one pair using only stored data.
 * Returns { drug, severity, mechanism, effect, recommendation, evidence[], source:'database' }.
 * severity 'safe' means "nothing found in either drug's stored sections";
 * 'unknown' means the stored records are too thin to say.
 */
export function analyzePair(primary, other) {
  const A = profileOf(primary);
  const B = profileOf(other);
  const name = other.generic_name;

  // 1. Verified classic contraindications
  const rule = absoluteRule(primary.generic_name, other.generic_name);
  if (rule) {
    return {
      drug: name, severity: 'contraindicated', source: 'database',
      mechanism: rule.mechanism, effect: rule.effect,
      recommendation: '⚠ VERIFIED CONTRAINDICATION: ' + rule.recommendation,
      evidence: [],
    };
  }

  // 2. Direct mentions, both directions
  const hits = [...mentionHits(A, B), ...mentionHits(B, A)];
  // 3. Overlapping risks + CYP
  const overlaps = overlapFindings(A, B);
  const cyps = cypFindings(A, B);

  let severity = 'safe';
  hits.forEach(h => { severity = maxSeverity(severity, h.severity); });
  if (overlaps.length || cyps.length) severity = maxSeverity(severity, 'monitor');

  if (severity === 'safe') {
    if (!A.sufficient || !B.sufficient) {
      const gaps = [];
      if (!A.sufficient) gaps.push(`${primary.generic_name}: ${A.missingCore.length ? A.missingCore.map(k => SECTIONS.find(s => s.key === k).label).join(', ') : 'Contraindications'}`);
      if (!B.sufficient) gaps.push(`${name}: ${B.missingCore.length ? B.missingCore.map(k => SECTIONS.find(s => s.key === k).label).join(', ') : 'Contraindications'}`);
      return {
        drug: name, severity: 'unknown', source: 'database',
        mechanism: null, effect: null,
        recommendation: `Nothing conflicting was found, but the stored records are too thin to call this safe — missing: ${gaps.join(' · ')}.`,
        evidence: [],
      };
    }
    return {
      drug: name, severity: 'safe', source: 'database',
      mechanism: null, effect: null,
      recommendation: 'No conflict found in the stored Contraindications, Precautions, Pharmacology, Adverse Effects or Nursing Action of either drug. This reflects the system\'s records only — confirm with a current reference.',
      evidence: [],
    };
  }

  // Build explanation from the strongest evidence first
  const ordered = [...hits].sort((x, y) => RANK[y.severity] - RANK[x.severity]);
  const evidence = [];
  const seen = new Set();
  ordered.forEach(h => {
    const k = h.drug + h.section + h.text;
    if (seen.has(k) || evidence.length >= 4) return;
    seen.add(k);
    evidence.push({
      drug: h.drug, section: h.section, text: h.text,
      note: h.kind === 'class' ? `refers to ${h.via} (${h.drug === A.drug.generic_name ? name : primary.generic_name}'s class)` : null,
    });
  });
  overlaps.slice(0, 3).forEach(o => o.evidence.forEach(e => {
    if (evidence.length < 6) evidence.push({ ...e, note: `shared risk: ${o.label}` });
  }));

  const mechanismParts = [];
  if (ordered[0]) {
    const h = ordered[0];
    mechanismParts.push(`${h.drug}'s ${h.section} section says: “${trimQuote(h.text, 200)}”`);
  }
  cyps.slice(0, 2).forEach(c => mechanismParts.push(c.text));

  const effectParts = overlaps.slice(0, 2).map(o => o.effect);
  if (!effectParts.length && ordered[0]) {
    effectParts.push(`Documented in the stored ${ordered[0].section.toLowerCase()} of ${ordered[0].drug}.`);
  }

  return {
    drug: name, severity, source: 'database',
    mechanism: mechanismParts.join(' ') || null,
    effect: effectParts.join(' ') || null,
    recommendation: REC[severity],
    evidence,
  };
}

// ── "Incompatible Drugs" list from the database ──────────────────────────
/**
 * Every drug in the database that conflicts with `primary`, plus class-level
 * warnings written in `primary`'s own text (e.g. "avoid with MAO inhibitors").
 */
export function findLocalIncompatibles(primary, allDrugs) {
  const rows = [];
  const P = profileOf(primary);

  (allDrugs || []).forEach(d => {
    if (!d || d.id === primary.id || !d.generic_name) return;
    if (norm(d.generic_name) === norm(primary.generic_name)) return;
    const r = analyzePair(primary, d);
    if (r.severity === 'contraindicated' || r.severity === 'monitor') {
      rows.push({ ...r, _score: RANK[r.severity] * 10 + Math.min(r.evidence.length, 5) });
    }
  });

  // Class-level warnings straight from the primary drug's own text
  const classSeen = new Set();
  P.sections.forEach(sec => {
    if (!['contraindications', 'interaction', 'precautions', 'administration', 'nursing'].includes(sec.key)) return;
    sec.sentences.forEach(s => {
      if (ALLERGY_ONLY.test(s.text)) return;
      CLASS_LEXICON.forEach(cls => {
        if (classSeen.has(cls.name) || P.memberOf.has(cls.name)) return;
        if (!cls.mention.test(s.text)) return;
        // Only warnings: skip neutral mentions in precautions/nursing
        if ((sec.key === 'precautions' || sec.key === 'nursing') && !(STRONG.test(s.text) || CAUTION.test(s.text))) return;
        classSeen.add(cls.name);
        const sev = severityFor(sec.key, s.text);
        rows.push({
          drug: `${cls.name} (class)`, severity: sev, source: 'database', isClass: true,
          mechanism: `${primary.generic_name}'s ${sec.label} section says: “${trimQuote(s.text, 220)}”`,
          effect: null,
          recommendation: REC[sev],
          evidence: [{ drug: primary.generic_name, section: sec.label, text: s.text, note: `refers to ${cls.name}` }],
          _score: RANK[sev] * 10,
        });
      });
    });
  });

  // Free-text warnings in the primary drug's own record that name no drug in
  // the database (e.g. "Do not mix with calcium-containing solutions",
  // "avoid alcohol"). Shown so the list never silently drops a stored warning.
  const coveredText = new Set();
  rows.forEach(r => r.evidence.forEach(e => coveredText.add(e.text)));
  const WARN_TARGET = /\b(with|mix\w*|dilut\w*|co-?administ\w*|alongside|solution|infusion|line|syringe|alcohol|grapefruit|food|milk|antacid)\b/i;
  let noteCount = 0;
  P.sections.forEach(sec => {
    if (!['contraindications', 'interaction', 'administration', 'precautions'].includes(sec.key)) return;
    sec.sentences.forEach(s => {
      if (noteCount >= 5 || coveredText.has(s.text)) return;
      if (ALLERGY_ONLY.test(s.text) || COMPARATIVE.test(s.text)) return;
      if (!(STRONG.test(s.text) && WARN_TARGET.test(s.text))) return;
      if (!INTERACTION_CUE.test(s.text) && sec.key !== 'contraindications') return;
      noteCount++;
      coveredText.add(s.text);
      const sev = severityFor(sec.key, s.text);
      rows.push({
        drug: `${sec.label}: ${trimQuote(s.text, 70)}`, severity: sev, source: 'database', isNote: true,
        mechanism: `${primary.generic_name}'s ${sec.label} section says: \u201c${trimQuote(s.text, 260)}\u201d`,
        effect: null,
        recommendation: REC[sev],
        evidence: [{ drug: primary.generic_name, section: sec.label, text: s.text, note: null }],
        _score: RANK[sev] * 10 - 1,
      });
    });
  });

  rows.sort((a, b) => b._score - a._score || a.drug.localeCompare(b.drug));
  return rows.map(({ _score, ...r }) => r);
}

// ── "Combination Therapy" list from the database ─────────────────────────
function comboSentences(profile) {
  const out = [];
  COMBO_FIELDS.forEach(([label, fields]) => {
    const text = fieldText(profile.drug, fields);
    splitSentences(text).forEach(t => out.push({ section: label, text: t }));
  });
  return out;
}

const COMBO_CUE = /\b(in combination with|combined with|combination (therapy|regimen|with|of)|(used|given|taken|administered) (together |concurrently )?with|along ?with|together with|add-?on|adjunct(ive)?|co-?administ\w*|plus|synerg\w*|augment\w*|triple therapy|dual therapy|regimen)\b|\s\+\s/i;

function dosageSnippet(d) {
  const t = fieldText(d, ['adult_dose', 'dosage']).replace(/\s+/g, ' ').trim();
  return t ? trimQuote(t, 140) : null;
}

// Break a sentence into the small clauses of a comma/bracket list so a quote
// shows the part that actually names the partner, not the whole line.
function clausesOf(text) {
  return text.split(/[,;()]/).map(c => c.trim()).filter(c => c.length >= 6);
}

/**
 * Partners that `primary`'s stored text (or the partner's own) describes as
 * used together with it. Only clean pairings are listed: anything the
 * interaction engine flags is excluded, matching the existing product rule.
 */
export function findLocalCombinations(primary, allDrugs) {
  const P = profileOf(primary);
  const rows = new Map();

  const add = (partner, quote, section, ownerName, via) => {
    const key = norm(partner.generic_name);
    if (rows.has(key)) return;
    const pair = analyzePair(primary, partner);
    if (pair.severity === 'contraindicated' || pair.severity === 'monitor') return;
    rows.set(key, {
      drug: partner.generic_name,
      source: 'database',
      indication: trimQuote(quote, 200),
      clinicalReason: `Documented in ${ownerName}'s ${section} section${via ? ` (as ${via})` : ''}: “${trimQuote(quote, 260)}”`,
      dosage: dosageSnippet(partner),
      frequency: null,
      duration: null,
      cautionNote: null,
      evidence: [{ drug: ownerName, section, text: quote, note: via ? `refers to ${via}` : null }],
    });
  };

  const others = (allDrugs || []).filter(d =>
    d && d.id !== primary.id && d.generic_name && norm(d.generic_name) !== norm(primary.generic_name));
  const otherProfiles = others.map(d => profileOf(d));

  // A. Primary's own text names a partner (by name, or by class in the same clause as a combination cue)
  comboSentences(P).forEach(s => {
    const sentenceHasCue = COMBO_CUE.test(s.text);
    clausesOf(s.text).forEach(clause => {
      const clauseHasCue = COMBO_CUE.test(clause);
      if (!sentenceHasCue && !clauseHasCue) return;
      let classAdds = 0;
      otherProfiles.forEach(Q => {
        if (Q.nameRegexes.some(re => re.test(clause))) {
          add(Q.drug, clause, s.section, primary.generic_name, null);
          return;
        }
        if (!clauseHasCue || classAdds >= 4) return;
        for (const cls of CLASS_LEXICON) {
          if (Q.memberOf.has(cls.name) && !P.memberOf.has(cls.name) && cls.mention.test(clause)) {
            const before = rows.size;
            add(Q.drug, clause, s.section, primary.generic_name, cls.name);
            if (rows.size > before) classAdds++;
            break;
          }
        }
      });
    });
  });

  // B. A partner's own text names the primary
  otherProfiles.forEach(Q => {
    comboSentences(Q).forEach(s => {
      if (!COMBO_CUE.test(s.text)) return;
      clausesOf(s.text).forEach(clause => {
        if (P.nameRegexes.some(re => re.test(clause))) add(Q.drug, clause, s.section, Q.drug.generic_name, null);
      });
    });
  });

  return [...rows.values()].slice(0, 15);
}

// ── Merging local (database) with AI results ─────────────────────────────
const normName = norm;

/** Combine a database verdict with an optional AI verdict for the same drug. */
export function mergePairResults(local, ai) {
  if (!ai) return local;
  const la = RANK[local.severity] ?? 0;
  const aa = RANK[ai.severity] ?? 0;

  // Evidence found in the system's own records is never overridden downward.
  if (la > aa || (la === aa && local.evidence?.length)) {
    return { ...local, source: la === aa ? 'both' : 'database', aiNote: aa > 0 ? ai.mechanism || null : null };
  }
  return { ...ai, evidence: local.evidence || [], source: la === aa && la > 1 ? 'both' : 'ai' };
}

/** Merge database + AI lists (incompatibles or combinations) by drug name. */
export function mergeLists(local, ai) {
  const map = new Map();
  local.forEach(r => map.set(normName(r.drug), r));
  (ai || []).forEach(r => {
    const k = normName(r.drug);
    const existing = map.get(k);
    if (existing) {
      map.set(k, { ...existing, source: 'both' });
    } else {
      map.set(k, { ...r, source: 'ai', evidence: [] });
    }
  });
  return [...map.values()].sort((a, b) => {
    const ra = RANK[b.severity] ?? 0, rb = RANK[a.severity] ?? 0;
    if (ra !== rb) return ra - rb;
    const order = { database: 0, both: 0, ai: 1 };
    return (order[a.source] ?? 1) - (order[b.source] ?? 1);
  });
}
