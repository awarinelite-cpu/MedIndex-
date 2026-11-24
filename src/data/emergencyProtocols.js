// src/data/emergencyProtocols.js
// Bedside emergency quick-guides. Bundled in the app (no network needed).
//
// CLINICAL SAFETY: summarised from WHO emergency/obstetric/paediatric
// guidance, the Nigeria Standard Treatment Guidelines (NSTG) and NCDC
// guidance. A clinician on the MedIndex team must review every dose against
// the current NSTG and the facility's own protocol before release, and
// again whenever guidelines change. Bump REVIEWED_ON after each review.
//
// weightDoses entry shape:
//   { label, perKg, unit, max?, under?: { kg, perKg }, conc?: { mgPerMl }, note? }
//   - dose = perKg × weight (or under.perKg when weight < under.kg), capped at max
//   - conc turns an mg dose into a volume in mL

export const REVIEWED_ON = 'Not yet clinically reviewed';
export const EMERGENCY_NUMBERS = [
  { label: 'National emergency', value: '112' },
  { label: 'NCDC toll-free', value: '6232' },
];

export const CATEGORIES = ['All', 'Obstetric', 'Newborn & Child', 'Medical', 'Infectious', 'Toxicology'];

export const EMERGENCY_PROTOCOLS = [
  {
    id: 'cardiac-arrest',
    title: 'Cardiac arrest (CPR)',
    short: 'Compressions, shock, adrenaline',
    category: 'Medical',
    color: '#d92d3a',
    recognise: ['Unresponsive, not breathing normally (gasping only), no pulse within 10 seconds'],
    immediate: [
      'Shout for help, note the time, and start chest compressions at once.',
      'Adult: compress the centre of the chest 5–6 cm deep at 100–120 per minute, allow full recoil.',
      'Give 30 compressions : 2 breaths (bag-valve-mask with oxygen if available). Child with 2 rescuers: 15 : 2.',
      'Attach the defibrillator/AED as soon as it arrives. Shockable rhythm (VF/pulseless VT): shock, then resume CPR straight away for 2 minutes.',
      'Rotate the person doing compressions every 2 minutes. Minimise pauses.',
      'Look for reversible causes: hypoxia, hypovolaemia, hypo/hyperkalaemia, hypoglycaemia, tension pneumothorax, tamponade, toxins, thrombosis.',
    ],
    drugs: [
      { name: 'Adrenaline (epinephrine) 1 mg IV/IO — adult', dose: '1 mg every 3–5 minutes. First dose as soon as possible if non-shockable; after the 3rd shock if shockable.' },
      { name: 'Amiodarone — shockable rhythm', dose: '300 mg IV after the 3rd shock; a further 150 mg may be given after the 5th shock.' },
    ],
    weightDoses: [
      { label: 'Child: adrenaline 0.01 mg/kg IV/IO (1:10,000 = 0.1 mg/mL)', perKg: 0.01, unit: 'mg', max: 1, conc: { mgPerMl: 0.1 }, note: 'Every 3–5 minutes.' },
    ],
    monitor: ['Rhythm check every 2 minutes', 'End-tidal CO₂ if available', 'Record every drug and shock with the time'],
    avoid: ['Do not stop compressions to give drugs or place airways.'],
    timer: { label: 'CPR cycle / adrenaline reminder', minutes: 2 },
  },
  {
    id: 'eclampsia',
    title: 'Eclampsia & severe pre-eclampsia',
    short: 'Magnesium sulphate, control BP',
    category: 'Obstetric',
    color: '#c2307a',
    recognise: [
      'Convulsions in pregnancy or after delivery',
      'Severe pre-eclampsia: BP ≥160/110 with headache, visual disturbance, epigastric pain, or proteinuria',
    ],
    immediate: [
      'Call for help. Left lateral position, protect from injury, maintain the airway, give oxygen.',
      'Do not leave the woman alone. Insert an IV line and a urinary catheter.',
      'Give magnesium sulphate (loading dose below) — it is the drug of choice to stop and prevent fits.',
      'Control severe hypertension (BP ≥160/110) to bring diastolic to 90–100 mmHg.',
      'Plan delivery after stabilising; refer to a facility able to do caesarean section if needed.',
      'Continue magnesium sulphate for 24 hours after delivery or the last convulsion, whichever is later.',
    ],
    drugs: [
      { name: 'MgSO₄ loading (Pritchard)', dose: '4 g IV (20 mL of 20%) slowly over 5–20 minutes PLUS 10 g IM as 5 g (10 mL of 50%) in each buttock, each with 1 mL of 2% lidocaine.' },
      { name: 'MgSO₄ maintenance', dose: '5 g IM every 4 hours, alternating buttocks — only if the checks below are met before EVERY dose.' },
      { name: 'Recurrent fit', dose: '2 g IV (4 mL of 50%) slowly over 5 minutes.' },
      { name: 'Antidote for MgSO₄ toxicity', dose: 'Calcium gluconate 1 g (10 mL of 10%) IV slowly over 10 minutes.' },
      { name: 'Nifedipine (oral)', dose: '10 mg orally; repeat after 30 minutes if BP stays ≥160/110.' },
      { name: 'Labetalol (IV) — if no asthma/heart block', dose: '20 mg IV, then 40 mg, then 80 mg at 10-minute intervals as needed. Follow facility maximum.' },
      { name: 'Hydralazine (IV)', dose: '5 mg IV slowly; repeat every 20 minutes as needed (usual maximum 20 mg).' },
    ],
    weightDoses: [],
    monitor: [
      'BEFORE each MgSO₄ dose: respiratory rate ≥16/min, knee (patellar) reflexes present, urine output ≥30 mL/hour (100 mL in 4 hours).',
      'If any check fails: withhold the dose and give calcium gluconate if breathing is depressed.',
      'BP, pulse, respiratory rate and fetal heart rate every 15 minutes initially.',
      'Strict fluid chart: total IV/oral fluids about 80 mL/hour.',
    ],
    avoid: [
      'Do not use diazepam or phenytoin as first line when MgSO₄ is available.',
      'Do not give ergometrine after delivery in these women (raises BP).',
      'Avoid fluid overload (risk of pulmonary oedema).',
    ],
    timer: { label: 'Next MgSO₄ maintenance dose', minutes: 240 },
  },
  {
    id: 'pph',
    title: 'Postpartum haemorrhage (PPH)',
    short: 'Massage, oxytocin, TXA, fluids',
    category: 'Obstetric',
    color: '#b4232f',
    recognise: ['Blood loss ≥500 mL after vaginal birth (≥1000 mL after caesarean), or any loss causing instability'],
    immediate: [
      'Call for help and note the time. Rub up the uterus (uterine massage) until it is firm.',
      'Give oxytocin immediately. Insert two large-bore IV lines; take blood for group, crossmatch and haemoglobin.',
      'Start IV crystalloid (Ringer\'s lactate or normal saline) rapidly. Give oxygen.',
      'Empty the bladder (catheterise). Check the placenta is complete; remove retained tissue if present.',
      'Examine the cervix, vagina and perineum for tears and repair them.',
      'If bleeding continues: bimanual uterine compression, give tranexamic acid, and arrange urgent referral/theatre. Do not delay transfer.',
    ],
    drugs: [
      { name: 'Oxytocin', dose: '10 IU IM, or 20–40 IU in 1 L IV fluid at about 60 drops/min. Do not give as an undiluted IV bolus.' },
      { name: 'Tranexamic acid', dose: '1 g IV slowly over 10 minutes within 3 hours of birth; repeat 1 g after 30 minutes if bleeding continues.' },
      { name: 'Misoprostol (if oxytocin unavailable or as add-on)', dose: '800 micrograms sublingually.' },
      { name: 'Ergometrine (only if NOT hypertensive/pre-eclamptic)', dose: '0.2 mg IM, repeat after 15 minutes if needed.' },
    ],
    weightDoses: [],
    monitor: ['Pulse, BP, respiratory rate every 15 minutes', 'Uterine tone and blood loss (measure it)', 'Urine output', 'Shock signs: cold clammy skin, fast weak pulse, confusion'],
    avoid: ['Do not give ergometrine to a hypertensive or pre-eclamptic woman.', 'Do not leave a woman with ongoing bleeding without a senior and a transfer plan.'],
    timer: { label: 'Reassess tone and blood loss', minutes: 15 },
  },
  {
    id: 'neonatal-resus',
    title: 'Newborn resuscitation',
    short: 'The golden minute: dry, warm, ventilate',
    category: 'Newborn & Child',
    color: '#e0791a',
    recognise: ['Baby not breathing or only gasping, limp, or heart rate <100 at birth'],
    immediate: [
      'Call for help. Dry the baby thoroughly, remove the wet cloth, keep warm (skin-to-skin or under a heater, cover the head).',
      'Position the head neutral. Clear the mouth then nose only if blocked or thick secretions. Stimulate by rubbing the back/soles.',
      'Not breathing or gasping after about 30 seconds: start bag-and-mask ventilation with room air at 40–60 breaths per minute. Start within the first minute of life.',
      'Check the chest rises with each breath. If not: reposition the head, re-seal the mask, check the airway.',
      'After 30 seconds of effective ventilation, check the heart rate. HR above 100 and breathing: stop. HR 60–100: continue ventilating.',
      'HR below 60 despite effective ventilation: start chest compressions (3 compressions : 1 breath) with oxygen if available; call a senior.',
      'Once breathing, keep skin-to-skin, start breastfeeding early, and monitor closely.',
    ],
    drugs: [
      { name: 'Adrenaline', dose: 'Only if HR stays below 60 after effective ventilation and compressions, and only by a trained provider following the facility protocol.' },
    ],
    weightDoses: [],
    monitor: ['Heart rate, breathing, colour and temperature', 'Blood glucose if unwell or preterm'],
    avoid: ['Do not routinely suction a baby who is breathing well.', 'Do not let the baby get cold.'],
    timer: { label: 'Golden minute / reassess', minutes: 0.5 },
  },
  {
    id: 'severe-malaria',
    title: 'Severe malaria',
    short: 'IV artesunate, glucose, convulsions',
    category: 'Infectious',
    color: '#1f8a5b',
    recognise: ['Positive malaria test (RDT/film) PLUS any of: impaired consciousness, convulsions, prostration, severe anaemia, respiratory distress, jaundice, dark urine, shock, persistent vomiting, hypoglycaemia'],
    immediate: [
      'Give IV artesunate immediately — do not wait for lab confirmation if severe malaria is strongly suspected, but take blood first.',
      'Check blood glucose now; treat hypoglycaemia if below 3.0 mmol/L (54 mg/dL) or below 2.5 mmol/L in a child.',
      'Treat convulsions (see Convulsions guide). Keep the airway clear; oxygen if saturation is low.',
      'Give IV fluids carefully (avoid overload). Consider blood transfusion for severe anaemia.',
      'Once the patient can take tablets and has had at least 24 hours of IV artesunate, complete treatment with a full course of an oral artemisinin combination therapy (ACT).',
      'Refer to a higher level of care if signs of organ failure.',
    ],
    drugs: [
      { name: 'IV artesunate (preferred)', dose: '2.4 mg/kg IV at 0, 12 and 24 hours, then once daily. Children under 20 kg: 3 mg/kg.' },
      { name: 'Alternative: artemether IM', dose: '3.2 mg/kg IM on day 1, then 1.6 mg/kg daily.' },
    ],
    weightDoses: [
      { label: 'IV artesunate per dose (0, 12, 24 h, then daily)', perKg: 2.4, unit: 'mg', under: { kg: 20, perKg: 3 }, note: 'Children under 20 kg use 3 mg/kg.' },
      { label: 'IM artemether loading dose (day 1)', perKg: 3.2, unit: 'mg', note: 'Then 1.6 mg/kg once daily.' },
    ],
    monitor: ['Blood glucose every 4–6 hours', 'Level of consciousness (AVPU/Glasgow)', 'Urine output and colour', 'Haemoglobin / PCV', 'Temperature'],
    avoid: ['Do not give quinine/artesunate-only oral courses as a substitute for the full ACT follow-on course.', 'Avoid aggressive fluid loading.'],
    timer: { label: 'Next artesunate dose', minutes: 720 },
  },
  {
    id: 'anaphylaxis',
    title: 'Anaphylaxis',
    short: 'IM adrenaline first, then support',
    category: 'Medical',
    color: '#8a3fd1',
    recognise: ['Sudden skin flushing/hives/swelling, throat tightness, wheeze or stridor, low BP or collapse after a drug, food or sting exposure'],
    immediate: [
      'Stop the trigger (e.g. stop the infusion/drug). Call for help.',
      'Give adrenaline IM into the outer mid-thigh immediately.',
      'Lay the person flat with legs raised (sit up if breathing is the main problem). Do not stand them up.',
      'Give high-flow oxygen. Start IV fluids: adults 500–1000 mL rapidly, children 20 mL/kg, repeat as needed.',
      'Repeat adrenaline every 5 minutes if there is no improvement.',
      'After stabilising give hydrocortisone and an antihistamine as adjuncts. Observe for at least 6 hours; watch for a second reaction.',
    ],
    drugs: [
      { name: 'Adrenaline 1 mg/mL (1:1000) IM — by age', dose: 'Adult and child over 12: 0.5 mL (0.5 mg). 6–12 years: 0.3 mL. 6 months–6 years: 0.15 mL. Under 6 months: 0.1–0.15 mL.' },
      { name: 'Hydrocortisone (adjunct)', dose: 'Adult: 200 mg IV slowly. Use paediatric dosing per facility protocol.' },
    ],
    weightDoses: [
      { label: 'Adrenaline IM 0.01 mg/kg (1 mg/mL)', perKg: 0.01, unit: 'mg', max: 0.5, conc: { mgPerMl: 1 }, note: 'Maximum 0.5 mg per dose. Repeat every 5 minutes.' },
    ],
    monitor: ['Airway, breathing, circulation continuously', 'BP and pulse every 5 minutes', 'Oxygen saturation'],
    avoid: ['Do not delay adrenaline to give antihistamines or steroids first.', 'Antihistamines and steroids do NOT treat airway swelling or shock.'],
    timer: { label: 'Repeat adrenaline if no improvement', minutes: 5 },
  },
  {
    id: 'convulsions',
    title: 'Convulsions / status epilepticus',
    short: 'Protect airway, check glucose, benzodiazepine',
    category: 'Medical',
    color: '#4a55d6',
    recognise: ['Seizure lasting more than 5 minutes, or repeated seizures without recovery in between'],
    immediate: [
      'Note the time the fit started. Protect from injury; position on the side (recovery position); nothing in the mouth.',
      'Give oxygen. Check blood glucose immediately and treat hypoglycaemia if low.',
      'In pregnancy or after delivery treat as eclampsia (use magnesium sulphate — see Eclampsia guide).',
      'Give diazepam if the fit has lasted over 5 minutes. Repeat once after 5–10 minutes if the fit continues.',
      'Look for the cause: fever/malaria, meningitis, hypoglycaemia, head injury, alcohol/drug withdrawal, poisoning.',
      'If seizures continue after two benzodiazepine doses, call a senior or refer urgently.',
    ],
    drugs: [
      { name: 'Diazepam IV — adult', dose: '10 mg IV slowly over 2 minutes; repeat once after 5–10 minutes if needed.' },
    ],
    weightDoses: [
      { label: 'Child: diazepam IV 0.2 mg/kg (5 mg/mL)', perKg: 0.2, unit: 'mg', max: 10, conc: { mgPerMl: 5 }, note: 'Give slowly. Watch breathing. Repeat once if needed.' },
      { label: 'Child: diazepam rectal 0.5 mg/kg', perKg: 0.5, unit: 'mg', max: 10, note: 'If no IV access. Repeat once if needed.' },
    ],
    monitor: ['Breathing rate and oxygen saturation (benzodiazepines can depress breathing)', 'Blood glucose', 'Temperature'],
    avoid: ['Do not restrain forcefully or put anything in the mouth.', 'Do not give more than two benzodiazepine doses without senior review.'],
    timer: { label: 'Seizure time / repeat dose window', minutes: 5 },
  },
  {
    id: 'hypoglycaemia',
    title: 'Hypoglycaemia',
    short: 'Glucose now, then recheck',
    category: 'Medical',
    color: '#d9871f',
    recognise: ['Blood glucose below 3.0 mmol/L (54 mg/dL), or 2.5 mmol/L (45 mg/dL) in a child, or typical symptoms with a low reading: sweating, shaking, confusion, drowsiness, fits'],
    immediate: [
      'If awake and able to swallow: give sugary drink or glucose (about 15–20 g) and recheck in 15 minutes.',
      'If drowsy, fitting or unable to swallow: give IV dextrose (doses below) by slow push into a good vein.',
      'Recheck blood glucose after 10–15 minutes and repeat the dose if still low.',
      'Once recovered, give a meal or start a glucose infusion to prevent recurrence. Find and treat the cause (insulin/sulphonylurea, sepsis, malaria, poor intake).',
      'If there is no IV access and glucagon is available: 1 mg IM (adult).',
    ],
    drugs: [
      { name: 'Adult IV', dose: '50 mL of 50% dextrose IV, or 100–200 mL of 10–20% dextrose. Follow facility protocol.' },
    ],
    weightDoses: [
      { label: 'Child: 10% dextrose 5 mL/kg IV', perKg: 5, unit: 'mL', note: 'Give slowly. Recheck glucose in 10–15 minutes.' },
    ],
    monitor: ['Blood glucose every 15 minutes until stable, then hourly', 'Level of consciousness'],
    avoid: ['Do not give 50% dextrose to children (use 10%).', 'Do not discharge until glucose is stable and the cause is addressed.'],
    timer: { label: 'Recheck blood glucose', minutes: 15 },
  },
  {
    id: 'snakebite',
    title: 'Snakebite',
    short: 'Immobilise, get to antivenom fast',
    category: 'Toxicology',
    color: '#5c7a1f',
    recognise: ['Bite with pain/swelling, bleeding from gums or wound, drooping eyelids, difficulty swallowing or breathing'],
    immediate: [
      'Move away from the snake. Keep the person calm and still.',
      'Immobilise the bitten limb with a splint or sling, at about heart level. Remove rings, watches and tight clothing before swelling.',
      'Transport to a facility with antivenom immediately. Do not wait for symptoms.',
      'DO NOT cut, suck, burn, apply a tourniquet, apply ice or give alcohol or traditional medicines.',
      'In facility: IV access (not in the bitten limb), baseline bloods, and do the 20-minute whole blood clotting test (20WBCT): place 2 mL of fresh blood in a clean dry glass tube, leave 20 minutes, then tilt. Unclotted blood = coagulopathy = give antivenom.',
      'Give polyvalent antivenom (covers Echis ocellatus and other local species) according to the product insert, with adrenaline ready for allergic reactions.',
      'Give tetanus prophylaxis. Monitor for airway weakness and bleeding.',
    ],
    drugs: [
      { name: 'Antivenom', dose: 'Dose and dilution follow the specific product label. Be ready to treat anaphylaxis.' },
    ],
    weightDoses: [],
    monitor: ['Repeat 20WBCT every 6 hours', 'Swelling progression (mark the edge with a pen and time)', 'Breathing, eyelids, swallowing (neurotoxicity)', 'Urine output and colour'],
    avoid: ['No tourniquet, cutting, suction or herbal applications.', 'Do not give NSAIDs/aspirin (bleeding risk).'],
    timer: { label: 'Repeat 20-minute clotting test', minutes: 20 },
  },
  {
    id: 'lassa',
    title: 'Suspected Lassa fever',
    short: 'Isolate, protect staff, notify NCDC',
    category: 'Infectious',
    color: '#7a2b2b',
    recognise: ['Fever with sore throat, vomiting, diarrhoea, chest/abdominal pain, bleeding or facial swelling, especially with rodent exposure or contact with a suspected case, after malaria and typhoid are considered'],
    immediate: [
      'Isolate the patient in a single room. Limit staff contact to those essential.',
      'Wear full PPE: gloves, gown, face mask or respirator, eye protection. Double-glove for procedures with blood exposure.',
      'Notify your State Epidemiologist / DSNO and call the NCDC toll-free line 6232 immediately.',
      'Collect samples only by trained staff using safe handling, for Lassa PCR as directed by NCDC.',
      'Start supportive care early: oral/IV rehydration, treat malaria and bacterial infection where indicated, correct electrolytes.',
      'Antiviral therapy (ribavirin) follows the current NCDC case-management guideline and should be started early on advice from the treatment centre.',
      'Arrange safe transfer to a designated Lassa treatment centre. Decontaminate surfaces with 0.5% chlorine solution.',
      'List and monitor contacts for 21 days.',
    ],
    drugs: [
      { name: 'Ribavirin', dose: 'Use the weight- and stage-based regimen in the current NCDC Lassa fever case management guideline.' },
    ],
    weightDoses: [],
    monitor: ['Temperature, BP, pulse, urine output', 'Bleeding, signs of shock', 'Staff and contact health surveillance'],
    avoid: ['Do not touch blood, vomit or urine without PPE.', 'Do not do invasive procedures unless clinically essential.'],
    timer: null,
  },
];

export const getProtocol = (id) => EMERGENCY_PROTOCOLS.find(p => p.id === id) || null;
