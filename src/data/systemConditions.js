// src/data/systemConditions.js
//
// Defines clinical conditions for each anatomical system.
// Each condition has a set of keyword patterns matched (case-insensitive,
// substring) against a drug's indications, primary_indications, overview,
// and drug_class/drug_subclass fields.
//
// A drug can appear under multiple conditions within a system — that is
// intentional and clinically accurate (e.g. Metoprolol → Hypertension AND
// Heart Failure AND Arrhythmia within the Cardiovascular system).

export const SYSTEM_CONDITIONS = {

  cardiovascular: [
    {
      id: 'angina',
      label: 'Angina & Ischaemic Heart Disease',
      icon: '💔',
      keywords: ['angina', 'ischaemic', 'ischemic', 'coronary', 'acute coronary', 'acs', 'myocardial infarction', 'mi ', ' mi,', 'nstemi', 'stemi', 'antianginal'],
    },
    {
      id: 'arrhythmia',
      label: 'Arrhythmia',
      icon: '⚡',
      keywords: ['arrhythmia', 'atrial fibrillation', 'atrial flutter', 'ventricular', 'tachycardia', 'bradycardia', 'rate control', 'antiarrhythmic', 'af ', ' af,', 'svt'],
    },
    {
      id: 'dyslipidaemia',
      label: 'Dyslipidaemia / High Cholesterol',
      icon: '🧪',
      keywords: ['cholesterol', 'lipid', 'dyslipid', 'statin', 'triglyceride', 'ldl', 'hdl', 'antilipemic', 'hyperlipid'],
    },
    {
      id: 'heart_failure',
      label: 'Heart Failure',
      icon: '❤️',
      keywords: ['heart failure', 'cardiac failure', 'hf with', 'systolic dysfunction', 'diastolic dysfunction', 'reduced ef', 'preserved ef', 'chf'],
    },
    {
      id: 'hypertension',
      label: 'Hypertension',
      icon: '🩺',
      keywords: ['hypertension', 'blood pressure', 'antihypertensive', 'high bp'],
    },
    {
      id: 'oedema',
      label: 'Oedema & Fluid Overload',
      icon: '💧',
      keywords: ['oedema', 'edema', 'fluid overload', 'diuretic', 'ascites', 'pulmonary oedema', 'loop diuretic'],
    },
    {
      id: 'shock',
      label: 'Shock & Haemodynamic Support',
      icon: '⚠️',
      keywords: ['shock', 'inotrope', 'vasopressor', 'haemodynamic', 'hemodynamic', 'cardiac output', 'dopamine', 'noradrenaline', 'norepinephrine', 'cardiogenic'],
    },
    {
      id: 'thromboembolism',
      label: 'Thromboembolism & Clotting',
      icon: '🔴',
      keywords: ['thrombosis', 'thromboembolic', 'dvt', 'pulmonary embolism', 'pe ', 'anticoagulant', 'antiplatelet', 'stroke prevention', 'clot', 'thrombolytic', 'venous thromboembolism'],
    },
  ],

  respiratory: [
    {
      id: 'allergy',
      label: 'Allergy & Rhinitis',
      icon: '🌿',
      keywords: ['allergy', 'allergic rhinitis', 'hay fever', 'antihistamine', 'leukotriene', 'anaphylaxis'],
    },
    {
      id: 'asthma',
      label: 'Asthma',
      icon: '🫁',
      keywords: ['asthma', 'bronchial asthma', 'bronchospasm', 'anti-asthmatic', 'inhaled corticosteroid'],
    },
    {
      id: 'copd',
      label: 'COPD & Emphysema',
      icon: '🌬️',
      keywords: ['copd', 'emphysema', 'chronic obstructive', 'chronic bronchitis'],
    },
    {
      id: 'cough',
      label: 'Cough & Upper Respiratory',
      icon: '🤧',
      keywords: ['cough', 'antitussive', 'expectorant', 'mucolytic', 'upper respiratory', 'nasal congestion', 'decongestant', 'rhinitis', 'sinusitis'],
    },
    {
      id: 'pulmonary_hypertension',
      label: 'Pulmonary Hypertension',
      icon: '💨',
      keywords: ['pulmonary hypertension', 'pulmonary arterial'],
    },
    {
      id: 'respiratory_infection',
      label: 'Respiratory Tract Infections',
      icon: '🦠',
      keywords: ['pneumonia', 'bronchitis', 'respiratory tract infection', 'lower respiratory', 'lung infection'],
    },
  ],

  gastrointestinal: [
    {
      id: 'constipation',
      label: 'Constipation',
      icon: '⏳',
      keywords: ['constipation', 'laxative', 'bowel', 'stool softener', 'osmotic laxative', 'stimulant laxative'],
    },
    {
      id: 'diarrhoea',
      label: 'Diarrhoea & IBS',
      icon: '💊',
      keywords: ['diarrhoea', 'diarrhea', 'antidiarrheal', 'ibs', 'irritable bowel', 'infectious diarrhoea', 'inflammatory bowel'],
    },
    {
      id: 'motility',
      label: 'GI Motility Disorders',
      icon: '🔄',
      keywords: ['motility', 'prokinetic', 'gastroparesis', 'antispasmodic', 'spasm'],
    },
    {
      id: 'ibd',
      label: "IBD (Crohn's & Ulcerative Colitis)",
      icon: '🩺',
      keywords: ['crohn', 'ulcerative colitis', 'inflammatory bowel disease', 'ibd'],
    },
    {
      id: 'liver',
      label: 'Liver Disease & Hepatic',
      icon: '🫀',
      keywords: ['hepatic', 'liver disease', 'cirrhosis', 'hepatitis', 'hepatoprotective', 'liver failure'],
    },
    {
      id: 'nausea',
      label: 'Nausea & Vomiting',
      icon: '🤢',
      keywords: ['nausea', 'vomiting', 'antiemetic', 'chemotherapy-induced', 'motion sickness', 'morning sickness', 'postoperative nausea'],
    },
    {
      id: 'peptic_ulcer',
      label: 'Peptic Ulcer & GERD',
      icon: '🔥',
      keywords: ['peptic ulcer', 'gerd', 'gastro-oesophageal', 'gastroesophageal', 'reflux', 'antacid', 'proton pump', 'h2 blocker', 'h2-receptor', 'h2 receptor', 'antiulcer', 'helicobacter', 'h. pylori'],
    },
  ],

  renal: [
    {
      id: 'bph',
      label: 'Benign Prostatic Hyperplasia',
      icon: '👨',
      keywords: ['bph', 'benign prostatic', 'prostate', '5-alpha reductase', 'alpha-blocker'],
    },
    {
      id: 'ckd',
      label: 'Chronic Kidney Disease',
      icon: '🫘',
      keywords: ['chronic kidney', 'ckd', 'renal failure', 'renal insufficiency', 'kidney disease', 'phosphate binder', 'renal anaemia'],
    },
    {
      id: 'fluid_electrolyte',
      label: 'Fluid & Electrolyte Balance',
      icon: '⚖️',
      keywords: ['electrolyte', 'hyponatraemia', 'hypokalaemia', 'hyperkalaemia', 'diuresis', 'fluid balance'],
    },
    {
      id: 'nephrotic',
      label: 'Nephrotic & Nephritic Syndrome',
      icon: '🧪',
      keywords: ['nephrotic', 'nephritic', 'proteinuria', 'glomerulo'],
    },
    {
      id: 'overactive_bladder',
      label: 'Overactive Bladder & Incontinence',
      icon: '💧',
      keywords: ['overactive bladder', 'incontinence', 'urge incontinence', 'urinary frequency'],
    },
    {
      id: 'uti',
      label: 'Urinary Tract Infection',
      icon: '🦠',
      keywords: ['urinary tract infection', 'uti', 'cystitis', 'pyelonephritis', 'urinary infection'],
    },
  ],

  endocrine: [
    {
      id: 'adrenal',
      label: 'Adrenal & Corticosteroids',
      icon: '⚗️',
      keywords: ['addison', 'adrenal insufficiency', 'cushing', 'corticosteroid', 'glucocorticoid', 'mineralocorticoid', 'steroid replacement'],
    },
    {
      id: 'diabetes',
      label: 'Diabetes Mellitus',
      icon: '🩸',
      keywords: ['diabetes', 'type 2 diabetes', 'type 1 diabetes', 'antidiabetic', 'insulin', 'hyperglycaemia', 'hyperglycemia', 'hypoglycaemia', 'sulfonylurea', 'biguanide', 'sglt2', 'dpp-4', 'glp-1', 'thiazolidinedione'],
    },
    {
      id: 'obesity',
      label: 'Obesity & Metabolic Syndrome',
      icon: '⚖️',
      keywords: ['obesity', 'weight loss', 'anti-obesity', 'metabolic syndrome', 'glp-1'],
    },
    {
      id: 'osteoporosis',
      label: 'Osteoporosis & Calcium Metabolism',
      icon: '🦴',
      keywords: ['osteoporosis', 'calcium', 'bisphosphonate', 'vitamin d', 'parathyroid', 'paget'],
    },
    {
      id: 'pituitary',
      label: 'Pituitary & Growth Disorders',
      icon: '🧠',
      keywords: ['acromegaly', 'growth hormone', 'pituitary', 'prolactin', 'hyperprolactinaemia'],
    },
    {
      id: 'thyroid',
      label: 'Thyroid Disorders',
      icon: '🦋',
      keywords: ['thyroid', 'hypothyroidism', 'hyperthyroidism', 'thyrotoxicosis', 'graves', 'goitre', 'antithyroid'],
    },
  ],

  neurological: [
    {
      id: 'dementia',
      label: "Dementia & Alzheimer's",
      icon: '🧠',
      keywords: ['dementia', 'alzheimer', 'cognitive impairment', 'cholinesterase inhibitor', 'memantine', 'nootropic'],
    },
    {
      id: 'epilepsy',
      label: 'Epilepsy & Seizures',
      icon: '⚡',
      keywords: ['epilep', 'seizure', 'anticonvulsant', 'antiepileptic', 'status epilepticus', 'absence seizure', 'tonic-clonic'],
    },
    {
      id: 'migraine',
      label: 'Migraine & Headache',
      icon: '🤕',
      keywords: ['migraine', 'headache', 'triptan', 'cluster headache', 'preventive migraine'],
    },
    {
      id: 'ms',
      label: 'Multiple Sclerosis',
      icon: '🔬',
      keywords: ['multiple sclerosis', ' ms ', 'demyelinat'],
    },
    {
      id: 'neuropathic_pain',
      label: 'Neuropathic Pain',
      icon: '🔥',
      keywords: ['neuropathic', 'neuralgia', 'trigeminal', 'diabetic neuropathy', 'peripheral neuropathy'],
    },
    {
      id: 'parkinsons',
      label: "Parkinson's Disease",
      icon: '🤲',
      keywords: ['parkinson', 'antiparkinson', 'dopaminergic', 'levodopa', 'dopamine agonist'],
    },
    {
      id: 'sleep',
      label: 'Sleep Disorders & Insomnia',
      icon: '😴',
      keywords: ['insomnia', 'sleep disorder', 'hypnotic', 'sedative', 'sleep onset', 'zolpidem', 'z-drug'],
    },
    {
      id: 'stroke',
      label: 'Stroke & Cerebrovascular',
      icon: '🩺',
      keywords: ['stroke', 'cerebrovascular', 'tia', 'transient ischaemic', 'cerebral', 'neuroprotect'],
    },
  ],

  musculoskeletal: [
    {
      id: 'arthritis',
      label: 'Arthritis (OA & RA)',
      icon: '🦴',
      keywords: ['arthritis', 'osteoarthritis', 'rheumatoid', 'dmard', 'antirheumatic', 'joint pain'],
    },
    {
      id: 'fibromyalgia',
      label: 'Fibromyalgia & Chronic Pain',
      icon: '😣',
      keywords: ['fibromyalgia', 'chronic pain', 'chronic widespread pain'],
    },
    {
      id: 'gout',
      label: 'Gout & Hyperuricaemia',
      icon: '🧪',
      keywords: ['gout', 'hyperuricaemia', 'hyperuricemia', 'uricosuric', 'uric acid', 'xanthine oxidase'],
    },
    {
      id: 'muscle_spasm',
      label: 'Muscle Spasm & Cramp',
      icon: '💪',
      keywords: ['muscle spasm', 'muscle relaxant', 'spasticity', 'cramp', 'muscular pain'],
    },
    {
      id: 'osteoporosis_msk',
      label: 'Osteoporosis',
      icon: '🦴',
      keywords: ['osteoporosis', 'bisphosphonate', 'bone density', 'fracture prevention'],
    },
    {
      id: 'pain_inflammation',
      label: 'Pain & Inflammation',
      icon: '🔥',
      keywords: ['pain', 'inflammation', 'nsaid', 'anti-inflammatory', 'analgesic', 'antipyretic'],
    },
  ],

  psychiatric: [
    {
      id: 'addiction',
      label: 'Addiction & Substance Misuse',
      icon: '🚫',
      keywords: ['alcohol withdrawal', 'opioid dependence', 'nicotine', 'addiction', 'substance misuse', 'withdrawal'],
    },
    {
      id: 'adhd',
      label: 'ADHD',
      icon: '⚡',
      keywords: ['adhd', 'attention deficit', 'hyperactivity', 'methylphenidate', 'amphetamine', 'stimulant'],
    },
    {
      id: 'anxiety',
      label: 'Anxiety Disorders',
      icon: '😟',
      keywords: ['anxiety', 'generalised anxiety', 'panic disorder', 'social anxiety', 'phobia', 'anxiolytic', 'gad', 'ptsd'],
    },
    {
      id: 'bipolar',
      label: 'Bipolar Disorder',
      icon: '🔄',
      keywords: ['bipolar', 'mania', 'manic episode', 'mood stabilizer', 'mood stabiliser', 'lithium'],
    },
    {
      id: 'depression',
      label: 'Depression',
      icon: '😔',
      keywords: ['depression', 'major depressive', 'antidepressant', 'ssri', 'snri', 'tricyclic', 'maoi', 'dysthymia'],
    },
    {
      id: 'ocd',
      label: 'OCD & Related Disorders',
      icon: '🔁',
      keywords: ['ocd', 'obsessive-compulsive', 'obsessive compulsive'],
    },
    {
      id: 'schizophrenia',
      label: 'Schizophrenia & Psychosis',
      icon: '🧩',
      keywords: ['schizophrenia', 'psychosis', 'psychotic', 'antipsychotic', 'delusion', 'hallucination', 'schizoaffective'],
    },
  ],

  infectious: [
    {
      id: 'bacterial',
      label: 'Bacterial Infections',
      icon: '🦠',
      keywords: ['bacterial', 'antibiotic', 'antibacterial', 'penicillin', 'cephalosporin', 'macrolide', 'fluoroquinolone', 'aminoglycoside', 'tetracycline', 'sulfonamide', 'carbapenem', 'sepsis', 'bacteraemia'],
    },
    {
      id: 'fungal',
      label: 'Fungal Infections',
      icon: '🍄',
      keywords: ['antifungal', 'candida', 'candidiasis', 'aspergillosis', 'cryptococcal', 'tinea', 'fungal'],
    },
    {
      id: 'immunosuppression',
      label: 'Immunosuppression & Transplant',
      icon: '🛡️',
      keywords: ['immunosuppress', 'transplant', 'rejection', 'tacrolimus', 'ciclosporin', 'mycophenolate'],
    },
    {
      id: 'malaria',
      label: 'Malaria & Tropical Diseases',
      icon: '🌍',
      keywords: ['malaria', 'antimalarial', 'plasmodium', 'tropical', 'leishmaniasis', 'trypanosomiasis'],
    },
    {
      id: 'parasites',
      label: 'Parasites & Helminths',
      icon: '🪱',
      keywords: ['parasite', 'antiparasitic', 'anthelmintic', 'helminth', 'worm', 'scabies', 'lice', 'protozoa'],
    },
    {
      id: 'tb',
      label: 'Tuberculosis',
      icon: '🫁',
      keywords: ['tuberculosis', 'tb ', ' tb,', 'antitubercular', 'rifampicin', 'isoniazid', 'pyrazinamide', 'ethambutol'],
    },
    {
      id: 'vaccines',
      label: 'Vaccines & Immunoglobulins',
      icon: '💉',
      keywords: ['vaccine', 'immunisation', 'immunization', 'immunoglobulin', 'vaccination'],
    },
    {
      id: 'viral',
      label: 'Viral Infections & HIV',
      icon: '🔬',
      keywords: ['antiviral', 'hiv', 'antiretroviral', 'herpes', 'influenza', 'hepatitis b', 'hepatitis c', 'covid', 'hbv', 'hcv'],
    },
  ],

  dermatological: [
    {
      id: 'acne',
      label: 'Acne',
      icon: '🔴',
      keywords: ['acne', 'comedone', 'isotretinoin', 'benzoyl peroxide', 'retinoid'],
    },
    {
      id: 'eczema',
      label: 'Eczema & Dermatitis',
      icon: '🌿',
      keywords: ['eczema', 'dermatitis', 'atopic', 'emollient', 'calcineurin inhibitor'],
    },
    {
      id: 'psoriasis',
      label: 'Psoriasis',
      icon: '🩹',
      keywords: ['psoriasis', 'psoriatic', 'calcipotriol'],
    },
    {
      id: 'fungal_skin',
      label: 'Skin & Nail Fungal Infections',
      icon: '🍄',
      keywords: ['tinea', 'onychomycosis', 'ringworm', 'antifungal', 'topical antifungal'],
    },
    {
      id: 'urticaria',
      label: 'Urticaria & Pruritus',
      icon: '😖',
      keywords: ['urticaria', 'pruritus', 'itch', 'antihistamine', 'hives'],
    },
    {
      id: 'wound',
      label: 'Wound Care & Antiseptics',
      icon: '🩹',
      keywords: ['wound', 'antiseptic', 'antibacterial (topical)', 'wound healing', 'ulcer (skin)'],
    },
  ],

  hematological: [
    {
      id: 'anaemia',
      label: 'Anaemia',
      icon: '🩸',
      keywords: ['anaemia', 'anemia', 'iron deficiency', 'haematinic', 'erythropoietin', 'b12', 'folate', 'folic acid', 'haemolytic'],
    },
    {
      id: 'bleeding',
      label: 'Bleeding Disorders & Haemostasis',
      icon: '🔴',
      keywords: ['haemostatic', 'hemostatic', 'haemophilia', 'hemophilia', 'von willebrand', 'bleeding disorder', 'tranexamic'],
    },
    {
      id: 'cancer',
      label: 'Cancer & Chemotherapy',
      icon: '🔬',
      keywords: ['chemotherapy', 'antineoplastic', 'oncology', 'cancer', 'leukaemia', 'leukemia', 'lymphoma', 'cytotoxic'],
    },
    {
      id: 'neutropenia',
      label: 'Neutropenia & Colony Stimulants',
      icon: '🛡️',
      keywords: ['neutropenia', 'colony-stimulating', 'granulocyte', 'g-csf'],
    },
    {
      id: 'thrombocytopenia',
      label: 'Thrombocytopenia',
      icon: '🩸',
      keywords: ['thrombocytopenia', 'platelet', 'itp'],
    },
  ],

  reproductive: [
    {
      id: 'contraception',
      label: 'Contraception',
      icon: '🛡️',
      keywords: ['contraceptive', 'contraception', 'oral contraceptive', 'emergency contraception', 'pill'],
    },
    {
      id: 'erectile',
      label: 'Erectile Dysfunction',
      icon: '💊',
      keywords: ['erectile dysfunction', 'ed ', ' ed,', 'pde5', 'sildenafil', 'tadalafil'],
    },
    {
      id: 'fertility',
      label: 'Fertility & Infertility',
      icon: '🌱',
      keywords: ['fertility', 'infertility', 'ovulation induction', 'clomiphene', 'ivf', 'gonadotropin'],
    },
    {
      id: 'menopause',
      label: 'Menopause & HRT',
      icon: '🦋',
      keywords: ['menopause', 'hrt', 'hormone replacement', 'oestrogen', 'estrogen', 'hot flush', 'postmenopausal'],
    },
    {
      id: 'menstrual',
      label: 'Menstrual Disorders',
      icon: '🌸',
      keywords: ['menstrual', 'dysmenorrhoea', 'dysmenorrhea', 'menorrhagia', 'amenorrhoea', 'endometriosis', 'pms'],
    },
    {
      id: 'obstetrics',
      label: 'Obstetrics & Labour',
      icon: '🤰',
      keywords: ['labour', 'labor', 'oxytocic', 'uterotonic', 'tocolytic', 'preterm labour', 'postpartum haemorrhage', 'oxytocin'],
    },
    {
      id: 'sti',
      label: 'Sexually Transmitted Infections',
      icon: '🦠',
      keywords: ['sexually transmitted', 'sti', 'gonorrhoea', 'gonorrhea', 'syphilis', 'chlamydia', 'genital herpes'],
    },
  ],

  sensory: [
    {
      id: 'dry_eye',
      label: 'Dry Eye & Lubricants',
      icon: '💧',
      keywords: ['dry eye', 'ocular lubricant', 'artificial tear'],
    },
    {
      id: 'ear',
      label: 'Ear Disorders & Infections',
      icon: '👂',
      keywords: ['otitis', 'ear infection', 'otic', 'hearing'],
    },
    {
      id: 'eye_infection',
      label: 'Eye Infections & Inflammation',
      icon: '👁️',
      keywords: ['conjunctivitis', 'keratitis', 'uveitis', 'ophthalmic', 'eye infection', 'eye drop'],
    },
    {
      id: 'glaucoma',
      label: 'Glaucoma',
      icon: '👁️',
      keywords: ['glaucoma', 'intraocular pressure', 'iop'],
    },
    {
      id: 'nasal',
      label: 'Nasal & Sinus Disorders',
      icon: '👃',
      keywords: ['nasal', 'sinusitis', 'rhinitis', 'nasal polyp', 'decongestant nasal'],
    },
  ],

  nutritional: [
    {
      id: 'malnutrition',
      label: 'Malnutrition & Deficiency',
      icon: '🥗',
      keywords: ['malnutrition', 'deficiency', 'nutritional supplement', 'kwashiorkor', 'marasmus', 'nutritional support'],
    },
    {
      id: 'minerals',
      label: 'Minerals & Electrolytes',
      icon: '⚗️',
      keywords: ['iron', 'calcium', 'magnesium', 'zinc', 'phosphate', 'potassium', 'sodium', 'electrolyte', 'mineral'],
    },
    {
      id: 'tpn',
      label: 'Total Parenteral Nutrition',
      icon: '💉',
      keywords: ['parenteral nutrition', 'tpn', 'enteral nutrition', 'tube feed'],
    },
    {
      id: 'vitamins',
      label: 'Vitamins',
      icon: '🌟',
      keywords: ['vitamin a', 'vitamin b', 'vitamin c', 'vitamin d', 'vitamin e', 'vitamin k', 'thiamine', 'riboflavin', 'niacin', 'pyridoxine', 'cyanocobalamin', 'ascorbic acid', 'retinol', 'tocopherol'],
    },
  ],

  pain: [
    {
      id: 'general_anaesthesia',
      label: 'General Anaesthesia',
      icon: '😴',
      keywords: ['general anaesthetic', 'general anesthetic', 'induction', 'propofol', 'thiopental', 'volatile', 'anaesthetic induction'],
    },
    {
      id: 'local_anaesthesia',
      label: 'Local Anaesthesia',
      icon: '💉',
      keywords: ['local anaesthetic', 'local anesthetic', 'lignocaine', 'lidocaine', 'bupivacaine', 'nerve block', 'regional anaesthesia'],
    },
    {
      id: 'mild_pain',
      label: 'Mild to Moderate Pain',
      icon: '💊',
      keywords: ['mild pain', 'moderate pain', 'paracetamol', 'acetaminophen', 'nsaid', 'ibuprofen', 'aspirin', 'analgesic', 'antipyretic'],
    },
    {
      id: 'palliative',
      label: 'Palliative & End-of-Life Care',
      icon: '🕊️',
      keywords: ['palliative', 'end of life', 'terminal', 'syringe driver', 'symptom control'],
    },
    {
      id: 'severe_pain',
      label: 'Severe & Chronic Pain',
      icon: '😣',
      keywords: ['severe pain', 'chronic pain', 'opioid', 'morphine', 'fentanyl', 'oxycodone', 'tramadol', 'strong opioid'],
    },
  ],

};;

/**
 * Given a drug and a system ID, returns the list of condition labels
 * that the drug matches within that system. A drug can match multiple conditions.
 */
// ── Keyword matching (used ONLY by the one-time backfill, not live display) ─
// Much stricter than the old loose substring scan:
//   • Searches ONLY the drug's indication fields — not overview, class,
//     subclass, or name — since those caused most false matches (e.g. every
//     drug in a class sweeping into a condition).
//   • Matches whole words/phrases at word boundaries, so "mi" no longer
//     matches inside other words and "pain" won't match "painless".
// This produces a cleaner starting set of tags for the backfill; admins then
// prune any remaining wrong matches with the remove button. Live display does
// NOT use this — it is strictly tag-based (see getDrugConditions below).
function matchesConditionByKeyword(drug, cond) {
  const text = [drug.indications, drug.primary_indications]
    .filter(Boolean).join(' ').toLowerCase();
  if (!text) return false;
  return cond.keywords.some(kwRaw => {
    const kw = kwRaw.trim().toLowerCase();
    if (kw.length < 3) return false; // ignore ultra-short noise keywords
    // Word-boundary match: keyword must be bounded by non-alphanumerics.
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
  });
}

// Same check as above, exported for use outside this module — specifically
// by the condition auto-fill job (AiInsightContext), which needs to verify
// an EXISTING drug the AI mentioned for a condition is actually indicated
// for it before blindly tagging it on, rather than trusting a name match
// alone (that was silently tagging drugs onto conditions they don't treat).
export function drugMatchesConditionKeywords(drug, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return null; // no keywords to check against — caller should skip the check
  return matchesConditionByKeyword(drug, { keywords });
}

// Suggest condition ids for a drug within a system, using the strict keyword
// rule above. Used by the admin backfill to seed condition_tags. Returns an
// array of condition ids.
export function suggestConditionTagsForDrug(drug, systemId, extraConditions = []) {
  const conditions = [...(SYSTEM_CONDITIONS[systemId] || []), ...extraConditions];
  return conditions.filter(cond => matchesConditionByKeyword(drug, cond)).map(c => c.id);
}

export function getDrugConditions(drug, systemId, extraConditions = []) {
  const conditions = [...(SYSTEM_CONDITIONS[systemId] || []), ...extraConditions];
  if (conditions.length === 0) return [];
  // STRICT: a drug belongs to a condition only if explicitly tagged.
  const tags = Array.isArray(drug.condition_tags) ? drug.condition_tags : [];
  return conditions.filter(cond => tags.includes(cond.id));
}

/**
 * Groups drugs by condition within a system.
 * Returns: Map<conditionId, { condition, drugs[] }>
 * A drug can appear in multiple conditions.
 */
export function groupDrugsByCondition(drugs, systemId, extraConditions = []) {
  const baseConditions = SYSTEM_CONDITIONS[systemId] || [];
  const rawConditions = [...baseConditions, ...extraConditions];
  if (rawConditions.length === 0) return new Map();

  // Defensively dedupe the condition list itself — by id first, then by
  // normalized label — so that any duplicate condition already present in
  // stored data (e.g. from before duplicate-prevention was added) collapses
  // to a single card instead of rendering twice or double-counting drugs.
  const seenIds = new Set();
  const seenLabels = new Set();
  const conditions = [];
  for (const cond of rawConditions) {
    const normLabel = (cond.label || '').toLowerCase().trim().replace(/[.,;:!?'"()/\\-]/g, '').replace(/\s+/g, ' ');
    if (seenIds.has(cond.id) || seenLabels.has(normLabel)) continue;
    seenIds.add(cond.id);
    seenLabels.add(normLabel);
    conditions.push(cond);
  }

  // Alphabetical by label so newly added custom/admin conditions slot in
  // next to the seeded ones instead of always trailing at the end.
  conditions.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'en', { sensitivity: 'base' }));

  const grouped = new Map();
  const uncategorised = [];

  for (const cond of conditions) {
    grouped.set(cond.id, { condition: cond, drugs: [] });
  }

  for (const drug of drugs) {
    // STRICT: a drug belongs to a condition only if its condition_tags
    // explicitly contains that condition's id. Keyword/text matching is no
    // longer used for live display — it caused drugs to appear under
    // conditions they didn't belong to. Tags are seeded once by the admin
    // backfill and curated with the remove button.
    const tags = Array.isArray(drug.condition_tags) ? drug.condition_tags : [];
    const matched = conditions.filter(cond => tags.includes(cond.id));

    if (matched.length === 0) {
      uncategorised.push(drug);
    } else {
      for (const cond of matched) {
        const entry = grouped.get(cond.id);
        // Guard against the same drug appearing twice under one condition.
        // We treat two entries as the same drug if they share an id OR the
        // same normalized generic name — the latter catches genuinely
        // separate Firestore documents for the same drug (e.g. slightly
        // different spellings/casings saved before dedup existed), which an
        // id-only check would miss and render as visible duplicates.
        const drugName = (drug.generic_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const dup = entry.drugs.some(d =>
          d.id === drug.id ||
          (drugName && (d.generic_name || '').trim().toLowerCase().replace(/\s+/g, ' ') === drugName)
        );
        if (!dup) {
          entry.drugs.push(drug);
        }
      }
    }
  }

  // Add uncategorised drugs at the end if any
  if (uncategorised.length > 0) {
    grouped.set('_other', {
      condition: { id: '_other', label: 'Other / General', icon: '💊' },
      drugs: uncategorised,
    });
  }

  // Keep all conditions — show even if no drugs match yet
  // (empty base conditions show as placeholder cards; custom conditions
  //  confirm to admin they saved successfully)
  for (const [id, entry] of grouped) {
    if (id === '_other' && entry.drugs.length === 0) {
      grouped.delete(id); // hide the catch-all only when empty
    }
  }

  return grouped;
}
