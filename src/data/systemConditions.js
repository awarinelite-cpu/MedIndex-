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
      id: 'acute_coronary_syndrome_and_myocardial_infarction',
      label: 'Acute Coronary Syndrome and Myocardial Infarction',
      icon: '❤️',
      keywords: ['acute coronary syndrome and myocardial infarction'],
    },
    {
      id: 'aneurysm_aortic',
      label: 'Aneurysm, Aortic',
      icon: '❤️',
      keywords: ['aneurysm', 'aortic', 'aortic aneurysm'],
    },
    {
      id: 'angina',
      label: 'Angina & Ischaemic Heart Disease',
      icon: '💔',
      keywords: ['angina', 'ischaemic', 'ischemic', 'coronary', 'acute coronary', 'acs', 'myocardial infarction', 'mi ', ' mi,', 'nstemi', 'stemi', 'antianginal'],
    },
    {
      id: 'angina_pectoris',
      label: 'Angina Pectoris',
      icon: '❤️',
      keywords: ['angina pectoris'],
    },
    {
      id: 'aortic_insufficiency',
      label: 'Aortic Insufficiency (Regurgitation)',
      icon: '❤️',
      keywords: ['aortic insufficiency', 'regurgitation'],
    },
    {
      id: 'aortic_stenosis',
      label: 'Aortic Stenosis',
      icon: '❤️',
      keywords: ['aortic stenosis'],
    },
    {
      id: 'arrhythmia',
      label: 'Arrhythmia',
      icon: '⚡',
      keywords: ['arrhythmia', 'atrial fibrillation', 'atrial flutter', 'ventricular', 'tachycardia', 'bradycardia', 'rate control', 'antiarrhythmic', 'af ', ' af,', 'svt'],
    },
    {
      id: 'arterial_embolism_and_arterial_thrombosis',
      label: 'Arterial Embolism and Arterial Thrombosis',
      icon: '❤️',
      keywords: ['arterial embolism and arterial thrombosis'],
    },
    {
      id: 'arteriosclerosis_and_atherosclerosis',
      label: 'Arteriosclerosis and Atherosclerosis',
      icon: '❤️',
      keywords: ['arteriosclerosis and atherosclerosis'],
    },
    {
      id: 'buergers_disease',
      label: "Buerger's Disease (Thromboangiitis Obliterans)",
      icon: '❤️',
      keywords: ["buerger's disease", 'thromboangiitis obliterans'],
    },
    {
      id: 'cardiac_arrest',
      label: 'Cardiac Arrest',
      icon: '❤️',
      keywords: ['cardiac arrest'],
    },
    {
      id: 'cardiomyopathies',
      label: 'Cardiomyopathies',
      icon: '❤️',
      keywords: ['cardiomyopathies'],
    },
    {
      id: 'coronary_atherosclerosis_and_cad',
      label: 'Coronary Atherosclerosis and CAD',
      icon: '❤️',
      keywords: ['coronary atherosclerosis and cad'],
    },
    {
      id: 'dyslipidaemia',
      label: 'Dyslipidaemia / High Cholesterol',
      icon: '🧪',
      keywords: ['cholesterol', 'lipid', 'dyslipid', 'statin', 'triglyceride', 'ldl', 'hdl', 'antilipemic', 'hyperlipid'],
    },
    {
      id: 'endocarditis_infective',
      label: 'Endocarditis, Infective',
      icon: '❤️',
      keywords: ['endocarditis', 'infective', 'infective endocarditis'],
    },
    {
      id: 'endocarditis_rheumatic',
      label: 'Endocarditis, Rheumatic',
      icon: '❤️',
      keywords: ['endocarditis', 'rheumatic', 'rheumatic endocarditis'],
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
      id: 'mitral_regurgitation',
      label: 'Mitral Regurgitation (Insufficiency)',
      icon: '❤️',
      keywords: ['insufficiency', 'mitral regurgitation'],
    },
    {
      id: 'mitral_stenosis',
      label: 'Mitral Stenosis',
      icon: '❤️',
      keywords: ['mitral stenosis'],
    },
    {
      id: 'mitral_valve_prolapse',
      label: 'Mitral Valve Prolapse',
      icon: '❤️',
      keywords: ['mitral valve prolapse'],
    },
    {
      id: 'myocarditis',
      label: 'Myocarditis',
      icon: '❤️',
      keywords: ['myocarditis'],
    },
    {
      id: 'oedema',
      label: 'Oedema & Fluid Overload',
      icon: '💧',
      keywords: ['oedema', 'edema', 'fluid overload', 'diuretic', 'ascites', 'pulmonary oedema', 'loop diuretic'],
    },
    {
      id: 'pericarditis',
      label: 'Pericarditis (Cardiac Tamponade)',
      icon: '❤️',
      keywords: ['cardiac tamponade', 'pericarditis'],
    },
    {
      id: 'peripheral_arterial_occlusive_disease',
      label: 'Peripheral Arterial Occlusive Disease',
      icon: '❤️',
      keywords: ['peripheral arterial occlusive disease'],
    },
    {
      id: 'pulmonary_arterial_hypertension',
      label: 'Pulmonary Arterial Hypertension',
      icon: '❤️',
      keywords: ['pulmonary arterial hypertension'],
    },
    {
      id: 'pulmonary_heart_disease',
      label: 'Pulmonary Heart Disease (Cor Pulmonale)',
      icon: '❤️',
      keywords: ['cor pulmonale', 'pulmonary heart disease'],
    },
    {
      id: 'raynauds_phenomenon',
      label: "Raynaud's Phenomenon",
      icon: '❤️',
      keywords: ["raynaud's phenomenon"],
    },
    {
      id: 'shock',
      label: 'Shock & Haemodynamic Support',
      icon: '⚠️',
      keywords: ['shock', 'inotrope', 'vasopressor', 'haemodynamic', 'hemodynamic', 'cardiac output', 'dopamine', 'noradrenaline', 'norepinephrine', 'cardiogenic'],
    },
    {
      id: 'shock_cardiogenic',
      label: 'Shock, Cardiogenic',
      icon: '❤️',
      keywords: ['cardiogenic', 'cardiogenic shock', 'shock'],
    },
    {
      id: 'shock_hypovolemic',
      label: 'Shock, Hypovolemic',
      icon: '❤️',
      keywords: ['hypovolemic', 'hypovolemic shock', 'shock'],
    },
    {
      id: 'thromboembolism',
      label: 'Thromboembolism & Clotting',
      icon: '🔴',
      keywords: ['thrombosis', 'thromboembolic', 'dvt', 'pulmonary embolism', 'pe ', 'anticoagulant', 'antiplatelet', 'stroke prevention', 'clot', 'thrombolytic', 'venous thromboembolism'],
    },
    {
      id: 'vein_disorders',
      label: 'Vein Disorders: Venous Thrombosis, Thrombophlebitis, Phlebothrombosis, and Deep Vein Thrombosis',
      icon: '❤️',
      keywords: ['and deep vein thrombosis', 'and deep vein thrombosis phlebothrombosis thrombophlebitis vein disorders: venous thrombosis', 'phlebothrombosis', 'thrombophlebitis', 'vein disorders: venous thrombosis', 'vein diso'],
    },
  ],

  respiratory: [
    {
      id: 'acute_respiratory_distress_syndrome',
      label: 'Acute Respiratory Distress Syndrome',
      icon: '🫁',
      keywords: ['acute respiratory distress syndrome'],
    },
    {
      id: 'allergy',
      label: 'Allergy & Rhinitis',
      icon: '🌿',
      keywords: ['allergy', 'allergic rhinitis', 'hay fever', 'antihistamine', 'leukotriene', 'anaphylaxis'],
    },
    {
      id: 'anaphylaxis',
      label: 'Anaphylaxis',
      icon: '⚠️',
      keywords: ['anaphylaxis'],
    },
    {
      id: 'asthma',
      label: 'Asthma',
      icon: '🫁',
      keywords: ['asthma', 'bronchial asthma', 'bronchospasm', 'anti-asthmatic', 'inhaled corticosteroid'],
    },
    {
      id: 'asthma_1',
      label: 'Asthma: Status Asthmaticus',
      icon: '🫁',
      keywords: ['asthma: status asthmaticus'],
    },
    {
      id: 'bronchiectasis',
      label: 'Bronchiectasis',
      icon: '🫁',
      keywords: ['bronchiectasis'],
    },
    {
      id: 'bronchitis_chronic',
      label: 'Bronchitis, Chronic',
      icon: '🫁',
      keywords: ['bronchitis', 'chronic', 'chronic bronchitis'],
    },
    {
      id: 'cancer_of_the_lung',
      label: 'Cancer of the Lung (Bronchogenic Carcinoma)',
      icon: '🎗️',
      keywords: ['bronchogenic carcinoma', 'cancer of the lung'],
    },
    {
      id: 'chronic_obstructive_pulmonary_disease',
      label: 'Chronic Obstructive Pulmonary Disease (COPD)',
      icon: '🫁',
      keywords: ['chronic obstructive pulmonary disease', 'copd'],
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
      id: 'emphysema_pulmonary',
      label: 'Emphysema, Pulmonary',
      icon: '🫁',
      keywords: ['emphysema', 'pulmonary', 'pulmonary emphysema'],
    },
    {
      id: 'empyema',
      label: 'Empyema',
      icon: '🫁',
      keywords: ['empyema'],
    },
    {
      id: 'influenza',
      label: 'Influenza',
      icon: '🫁',
      keywords: ['influenza'],
    },
    {
      id: 'lung_abscess',
      label: 'Lung Abscess',
      icon: '🫁',
      keywords: ['lung abscess'],
    },
    {
      id: 'pleural_effusion',
      label: 'Pleural Effusion',
      icon: '🫁',
      keywords: ['pleural effusion'],
    },
    {
      id: 'pleurisy',
      label: 'Pleurisy',
      icon: '🫁',
      keywords: ['pleurisy'],
    },
    {
      id: 'pneumonia',
      label: 'Pneumonia',
      icon: '🫁',
      keywords: ['pneumonia'],
    },
    {
      id: 'pneumothorax_and_hemothorax',
      label: 'Pneumothorax and Hemothorax',
      icon: '🫁',
      keywords: ['pneumothorax and hemothorax'],
    },
    {
      id: 'pulmonary_edema_acute',
      label: 'Pulmonary Edema, Acute',
      icon: '🫁',
      keywords: ['acute', 'acute pulmonary edema', 'pulmonary edema'],
    },
    {
      id: 'pulmonary_embolism',
      label: 'Pulmonary Embolism',
      icon: '🫁',
      keywords: ['pulmonary embolism'],
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
    {
      id: 'tuberculosis_pulmonary',
      label: 'Tuberculosis, Pulmonary',
      icon: '🫁',
      keywords: ['pulmonary', 'pulmonary tuberculosis', 'tuberculosis'],
    },
  ],

  gastrointestinal: [
    {
      id: 'appendicitis',
      label: 'Appendicitis',
      icon: '🍽️',
      keywords: ['appendicitis'],
    },
    {
      id: 'bowel_obstruction_large',
      label: 'Bowel Obstruction, Large',
      icon: '🍽️',
      keywords: ['bowel obstruction', 'large', 'large bowel obstruction'],
    },
    {
      id: 'bowel_obstruction_small',
      label: 'Bowel Obstruction, Small',
      icon: '🍽️',
      keywords: ['bowel obstruction', 'small', 'small bowel obstruction'],
    },
    {
      id: 'cancer_of_the_colon_and_rectum',
      label: 'Cancer of the Colon and Rectum (Colorectal Cancer)',
      icon: '🎗️',
      keywords: ['cancer of the colon and rectum', 'colorectal cancer'],
    },
    {
      id: 'cancer_of_the_esophagus',
      label: 'Cancer of the Esophagus',
      icon: '🎗️',
      keywords: ['cancer of the esophagus'],
    },
    {
      id: 'cancer_of_the_liver',
      label: 'Cancer of the Liver',
      icon: '🎗️',
      keywords: ['cancer of the liver'],
    },
    {
      id: 'cancer_of_the_oral_cavity_and_pharynx',
      label: 'Cancer of the Oral Cavity and Pharynx',
      icon: '🎗️',
      keywords: ['cancer of the oral cavity and pharynx'],
    },
    {
      id: 'cancer_of_the_pancreas',
      label: 'Cancer of the Pancreas',
      icon: '🎗️',
      keywords: ['cancer of the pancreas'],
    },
    {
      id: 'cancer_of_the_stomach',
      label: 'Cancer of the Stomach (Gastric Cancer)',
      icon: '🎗️',
      keywords: ['cancer of the stomach', 'gastric cancer'],
    },
    {
      id: 'cholelithiasis',
      label: 'Cholelithiasis (and Cholecystitis)',
      icon: '🍽️',
      keywords: ['and cholecystitis', 'cholelithiasis'],
    },
    {
      id: 'cirrhosis_hepatic',
      label: 'Cirrhosis, Hepatic',
      icon: '🍽️',
      keywords: ['cirrhosis', 'hepatic', 'hepatic cirrhosis'],
    },
    {
      id: 'constipation',
      label: 'Constipation',
      icon: '⏳',
      keywords: ['constipation', 'laxative', 'bowel', 'stool softener', 'osmotic laxative', 'stimulant laxative'],
    },
    {
      id: 'diarrhea',
      label: 'Diarrhea',
      icon: '🍽️',
      keywords: ['diarrhea'],
    },
    {
      id: 'diarrhoea',
      label: 'Diarrhoea & IBS',
      icon: '💊',
      keywords: ['diarrhoea', 'diarrhea', 'antidiarrheal', 'ibs', 'irritable bowel', 'infectious diarrhoea', 'inflammatory bowel'],
    },
    {
      id: 'diverticular_disease',
      label: 'Diverticular Disease',
      icon: '🍽️',
      keywords: ['diverticular disease'],
    },
    {
      id: 'esophageal_varices_bleeding',
      label: 'Esophageal Varices, Bleeding',
      icon: '🍽️',
      keywords: ['bleeding', 'bleeding esophageal varices', 'esophageal varices'],
    },
    {
      id: 'gastritis',
      label: 'Gastritis',
      icon: '🍽️',
      keywords: ['gastritis'],
    },
    {
      id: 'motility',
      label: 'GI Motility Disorders',
      icon: '🔄',
      keywords: ['motility', 'prokinetic', 'gastroparesis', 'antispasmodic', 'spasm'],
    },
    {
      id: 'hepatic_encephalopathy_and_hepatic_coma',
      label: 'Hepatic Encephalopathy and Hepatic Coma',
      icon: '🍽️',
      keywords: ['hepatic encephalopathy and hepatic coma'],
    },
    {
      id: 'hepatic_failure_fulminant',
      label: 'Hepatic Failure, Fulminant',
      icon: '🍽️',
      keywords: ['fulminant', 'fulminant hepatic failure', 'hepatic failure'],
    },
    {
      id: 'hepatitis_viral',
      label: 'Hepatitis, Viral: Types A, B, C, D, E, and G',
      icon: '🍽️',
      keywords: ['and g', 'and g e d c b viral: types a hepatitis', 'b', 'c', 'd', 'e', 'hepatitis', 'viral: types a'],
    },
    {
      id: 'hiatal_hernia',
      label: 'Hiatal Hernia',
      icon: '🍽️',
      keywords: ['hiatal hernia'],
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
      id: 'pancreatitis_acute',
      label: 'Pancreatitis, Acute',
      icon: '🍽️',
      keywords: ['acute', 'acute pancreatitis', 'pancreatitis'],
    },
    {
      id: 'pancreatitis_chronic',
      label: 'Pancreatitis, Chronic',
      icon: '🍽️',
      keywords: ['chronic', 'chronic pancreatitis', 'pancreatitis'],
    },
    {
      id: 'peptic_ulcer',
      label: 'Peptic Ulcer & GERD',
      icon: '🔥',
      keywords: ['peptic ulcer', 'gerd', 'gastro-oesophageal', 'gastroesophageal', 'reflux', 'antacid', 'proton pump', 'h2 blocker', 'h2-receptor', 'h2 receptor', 'antiulcer', 'helicobacter', 'h. pylori'],
    },
    {
      id: 'peritonitis',
      label: 'Peritonitis',
      icon: '🍽️',
      keywords: ['peritonitis'],
    },
    {
      id: 'regional_enteritis',
      label: "Regional Enteritis (Crohn's Disease)",
      icon: '🍽️',
      keywords: ["crohn's disease", 'regional enteritis'],
    },
    {
      id: 'ulcerative_colitis',
      label: 'Ulcerative Colitis',
      icon: '🍽️',
      keywords: ['ulcerative colitis'],
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
      id: 'cancer_of_the_bladder',
      label: 'Cancer of the Bladder',
      icon: '🎗️',
      keywords: ['cancer of the bladder'],
    },
    {
      id: 'cancer_of_the_kidneys',
      label: 'Cancer of the Kidneys (Renal Tumors)',
      icon: '🎗️',
      keywords: ['cancer of the kidneys', 'renal tumors'],
    },
    {
      id: 'ckd',
      label: 'Chronic Kidney Disease',
      icon: '🫘',
      keywords: ['chronic kidney', 'ckd', 'renal failure', 'renal insufficiency', 'kidney disease', 'phosphate binder', 'renal anaemia'],
    },
    {
      id: 'cystitis',
      label: 'Cystitis (Lower UTI)',
      icon: '🚰',
      keywords: ['cystitis', 'lower uti'],
    },
    {
      id: 'fluid_electrolyte',
      label: 'Fluid & Electrolyte Balance',
      icon: '⚖️',
      keywords: ['electrolyte', 'hyponatraemia', 'hypokalaemia', 'hyperkalaemia', 'diuresis', 'fluid balance'],
    },
    {
      id: 'glomerulonephritis_chronic',
      label: 'Glomerulonephritis, Chronic',
      icon: '🚰',
      keywords: ['chronic', 'chronic glomerulonephritis', 'glomerulonephritis'],
    },
    {
      id: 'nephritic_syndrome_acute',
      label: 'Nephritic Syndrome, Acute',
      icon: '🚰',
      keywords: ['acute', 'acute nephritic syndrome', 'nephritic syndrome'],
    },
    {
      id: 'nephrotic',
      label: 'Nephrotic & Nephritic Syndrome',
      icon: '🧪',
      keywords: ['nephrotic', 'nephritic', 'proteinuria', 'glomerulo'],
    },
    {
      id: 'nephrotic_syndrome',
      label: 'Nephrotic Syndrome',
      icon: '🚰',
      keywords: ['nephrotic syndrome'],
    },
    {
      id: 'overactive_bladder',
      label: 'Overactive Bladder & Incontinence',
      icon: '💧',
      keywords: ['overactive bladder', 'incontinence', 'urge incontinence', 'urinary frequency'],
    },
    {
      id: 'pyelonephritis_acute',
      label: 'Pyelonephritis, Acute',
      icon: '🚰',
      keywords: ['acute', 'acute pyelonephritis', 'pyelonephritis'],
    },
    {
      id: 'pyelonephritis_chronic',
      label: 'Pyelonephritis, Chronic',
      icon: '🚰',
      keywords: ['chronic', 'chronic pyelonephritis', 'pyelonephritis'],
    },
    {
      id: 'renal_failure_acute',
      label: 'Renal Failure, Acute',
      icon: '🚰',
      keywords: ['acute', 'acute renal failure', 'renal failure'],
    },
    {
      id: 'renal_failure_chronic',
      label: 'Renal Failure, Chronic (End-Stage Renal Disease)',
      icon: '🚰',
      keywords: ['chronic', 'chronic renal failure', 'end-stage renal disease', 'renal failure'],
    },
    {
      id: 'uti',
      label: 'Urinary Tract Infection',
      icon: '🦠',
      keywords: ['urinary tract infection', 'uti', 'cystitis', 'pyelonephritis', 'urinary infection'],
    },
    {
      id: 'urolithiasis',
      label: 'Urolithiasis',
      icon: '🚰',
      keywords: ['urolithiasis'],
    },
  ],

  endocrine: [
    {
      id: 'addisons_disease',
      label: "Addison's Disease (Adrenocortical Insufficiency)",
      icon: '⚙️',
      keywords: ["addison's disease", 'adrenocortical insufficiency'],
    },
    {
      id: 'adrenal',
      label: 'Adrenal & Corticosteroids',
      icon: '⚗️',
      keywords: ['addison', 'adrenal insufficiency', 'cushing', 'corticosteroid', 'glucocorticoid', 'mineralocorticoid', 'steroid replacement'],
    },
    {
      id: 'cancer_of_the_thyroid',
      label: 'Cancer of the Thyroid',
      icon: '🎗️',
      keywords: ['cancer of the thyroid'],
    },
    {
      id: 'cushing_syndrome',
      label: 'Cushing Syndrome',
      icon: '⚙️',
      keywords: ['cushing syndrome'],
    },
    {
      id: 'diabetes_insipidus',
      label: 'Diabetes Insipidus',
      icon: '⚙️',
      keywords: ['diabetes insipidus'],
    },
    {
      id: 'diabetes',
      label: 'Diabetes Mellitus',
      icon: '🩸',
      keywords: ['diabetes', 'type 2 diabetes', 'type 1 diabetes', 'antidiabetic', 'insulin', 'hyperglycaemia', 'hyperglycemia', 'hypoglycaemia', 'sulfonylurea', 'biguanide', 'sglt2', 'dpp-4', 'glp-1', 'thiazolidinedione'],
    },
    {
      id: 'diabetic_ketoacidosis',
      label: 'Diabetic Ketoacidosis',
      icon: '⚙️',
      keywords: ['diabetic ketoacidosis'],
    },
    {
      id: 'hyperglycemic_hyperosmolar_nonketotic_syndrome',
      label: 'Hyperglycemic Hyperosmolar Nonketotic Syndrome',
      icon: '⚙️',
      keywords: ['hyperglycemic hyperosmolar nonketotic syndrome'],
    },
    {
      id: 'hyperthyroidism',
      label: "Hyperthyroidism (Graves' Disease)",
      icon: '⚙️',
      keywords: ["graves' disease", 'hyperthyroidism'],
    },
    {
      id: 'hypoglycemia',
      label: 'Hypoglycemia (Insulin Reaction)',
      icon: '⚙️',
      keywords: ['hypoglycemia', 'insulin reaction'],
    },
    {
      id: 'hypoparathyroidism',
      label: 'Hypoparathyroidism',
      icon: '⚙️',
      keywords: ['hypoparathyroidism'],
    },
    {
      id: 'hypopituitarism',
      label: 'Hypopituitarism',
      icon: '⚙️',
      keywords: ['hypopituitarism'],
    },
    {
      id: 'hypothyroidism_and_myxedema',
      label: 'Hypothyroidism and Myxedema',
      icon: '⚙️',
      keywords: ['hypothyroidism and myxedema'],
    },
    {
      id: 'obesity',
      label: 'Obesity & Metabolic Syndrome',
      icon: '⚖️',
      keywords: ['obesity', 'weight loss', 'anti-obesity', 'metabolic syndrome', 'glp-1'],
    },
    {
      id: 'obesity_morbid',
      label: 'Obesity, Morbid',
      icon: '⚙️',
      keywords: ['morbid', 'morbid obesity', 'obesity'],
    },
    {
      id: 'osteoporosis',
      label: 'Osteoporosis & Calcium Metabolism',
      icon: '🦴',
      keywords: ['osteoporosis', 'calcium', 'bisphosphonate', 'vitamin d', 'parathyroid', 'paget'],
    },
    {
      id: 'pheochromocytoma',
      label: 'Pheochromocytoma',
      icon: '⚙️',
      keywords: ['pheochromocytoma'],
    },
    {
      id: 'pituitary',
      label: 'Pituitary & Growth Disorders',
      icon: '🧠',
      keywords: ['acromegaly', 'growth hormone', 'pituitary', 'prolactin', 'hyperprolactinaemia'],
    },
    {
      id: 'pituitary_tumors',
      label: 'Pituitary Tumors',
      icon: '⚙️',
      keywords: ['pituitary tumors'],
    },
    {
      id: 'syndrome_of_inappropriate_antidiuretic_hormone_secretion',
      label: 'Syndrome of Inappropriate Antidiuretic Hormone Secretion',
      icon: '⚙️',
      keywords: ['syndrome of inappropriate antidiuretic hormone secretion'],
    },
    {
      id: 'thyroid',
      label: 'Thyroid Disorders',
      icon: '🦋',
      keywords: ['thyroid', 'hypothyroidism', 'hyperthyroidism', 'thyrotoxicosis', 'graves', 'goitre', 'antithyroid'],
    },
    {
      id: 'thyroid_storm',
      label: 'Thyroid Storm (Thyrotoxic Crisis)',
      icon: '⚙️',
      keywords: ['thyroid storm', 'thyrotoxic crisis'],
    },
    {
      id: 'thyroiditis_acute',
      label: 'Thyroiditis, Acute',
      icon: '⚙️',
      keywords: ['acute', 'acute thyroiditis', 'thyroiditis'],
    },
    {
      id: 'thyroiditis_chronic',
      label: "Thyroiditis, Chronic (Hashimoto's Thyroiditis)",
      icon: '⚙️',
      keywords: ['chronic', 'chronic thyroiditis', "hashimoto's thyroiditis", 'thyroiditis'],
    },
  ],

  neurological: [
    {
      id: 'alzheimers_disease',
      label: "Alzheimer's Disease",
      icon: '🧠',
      keywords: ["alzheimer's disease"],
    },
    {
      id: 'amyotrophic_lateral_sclerosis',
      label: 'Amyotrophic Lateral Sclerosis',
      icon: '🧠',
      keywords: ['amyotrophic lateral sclerosis'],
    },
    {
      id: 'aneurysm_intracranial',
      label: 'Aneurysm, Intracranial',
      icon: '🧠',
      keywords: ['aneurysm', 'intracranial', 'intracranial aneurysm'],
    },
    {
      id: 'bells_palsy',
      label: "Bell's Palsy",
      icon: '🧠',
      keywords: ["bell's palsy"],
    },
    {
      id: 'brain_abscess',
      label: 'Brain Abscess',
      icon: '🧠',
      keywords: ['brain abscess'],
    },
    {
      id: 'brain_tumors',
      label: 'Brain Tumors',
      icon: '🧠',
      keywords: ['brain tumors'],
    },
    {
      id: 'cerebral_vascular_accident',
      label: 'Cerebral Vascular Accident (Ischemic Stroke)',
      icon: '🧠',
      keywords: ['cerebral vascular accident', 'ischemic stroke'],
    },
    {
      id: 'dementia',
      label: "Dementia & Alzheimer's",
      icon: '🧠',
      keywords: ['dementia', 'alzheimer', 'cognitive impairment', 'cholinesterase inhibitor', 'memantine', 'nootropic'],
    },
    {
      id: 'epilepsies',
      label: 'Epilepsies',
      icon: '🧠',
      keywords: ['epilepsies'],
    },
    {
      id: 'epilepsy',
      label: 'Epilepsy & Seizures',
      icon: '⚡',
      keywords: ['epilep', 'seizure', 'anticonvulsant', 'antiepileptic', 'status epilepticus', 'absence seizure', 'tonic-clonic'],
    },
    {
      id: 'guillain_barr_syndrome',
      label: 'Guillain-Barré Syndrome (Polyradiculoneuritis)',
      icon: '🧠',
      keywords: ['guillain-barré syndrome', 'polyradiculoneuritis'],
    },
    {
      id: 'head_injury',
      label: 'Head Injury (Brain Injury)',
      icon: '🧠',
      keywords: ['brain injury', 'head injury'],
    },
    {
      id: 'headache',
      label: 'Headache',
      icon: '🧠',
      keywords: ['headache'],
    },
    {
      id: 'huntington_disease',
      label: 'Huntington Disease',
      icon: '🧠',
      keywords: ['huntington disease'],
    },
    {
      id: 'increased_intracranial_pressure',
      label: 'Increased Intracranial Pressure',
      icon: '🧠',
      keywords: ['increased intracranial pressure'],
    },
    {
      id: 'meningitis',
      label: 'Meningitis',
      icon: '🧠',
      keywords: ['meningitis'],
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
      id: 'myasthenia_gravis',
      label: 'Myasthenia Gravis',
      icon: '🧠',
      keywords: ['myasthenia gravis'],
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
      id: 'spinal_cord_injury',
      label: 'Spinal Cord Injury',
      icon: '🧠',
      keywords: ['spinal cord injury'],
    },
    {
      id: 'stroke',
      label: 'Stroke & Cerebrovascular',
      icon: '🩺',
      keywords: ['stroke', 'cerebrovascular', 'tia', 'transient ischaemic', 'cerebral', 'neuroprotect'],
    },
    {
      id: 'trigeminal_neuralgia',
      label: 'Trigeminal Neuralgia (Tic Douloureux)',
      icon: '🧠',
      keywords: ['tic douloureux', 'trigeminal neuralgia'],
    },
    {
      id: 'unconscious_patient',
      label: 'Unconscious Patient',
      icon: '🧠',
      keywords: ['unconscious patient'],
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
      id: 'arthritis_rheumatoid',
      label: 'Arthritis, Rheumatoid',
      icon: '🦴',
      keywords: ['arthritis', 'rheumatoid', 'rheumatoid arthritis'],
    },
    {
      id: 'back_pain_low',
      label: 'Back Pain, Low',
      icon: '🦴',
      keywords: ['back pain', 'low', 'low back pain'],
    },
    {
      id: 'bone_tumors',
      label: 'Bone Tumors',
      icon: '🦴',
      keywords: ['bone tumors'],
    },
    {
      id: 'fibromyalgia',
      label: 'Fibromyalgia & Chronic Pain',
      icon: '😣',
      keywords: ['fibromyalgia', 'chronic pain', 'chronic widespread pain'],
    },
    {
      id: 'fractures',
      label: 'Fractures',
      icon: '🦴',
      keywords: ['fractures'],
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
      id: 'muscular_dystrophies',
      label: 'Muscular Dystrophies',
      icon: '🦴',
      keywords: ['muscular dystrophies'],
    },
    {
      id: 'musculoskeletal_trauma',
      label: 'Musculoskeletal Trauma (Contusions, Strains, Sprains, and Joint Dislocations)',
      icon: '🦴',
      keywords: ['contusions', 'joint dislocations', 'musculoskeletal trauma', 'sprains', 'strains'],
    },
    {
      id: 'osteoarthritis',
      label: 'Osteoarthritis (Degenerative Joint Disease)',
      icon: '🦴',
      keywords: ['degenerative joint disease', 'osteoarthritis'],
    },
    {
      id: 'osteomalacia',
      label: 'Osteomalacia',
      icon: '🦴',
      keywords: ['osteomalacia'],
    },
    {
      id: 'osteomyelitis',
      label: 'Osteomyelitis',
      icon: '🦴',
      keywords: ['osteomyelitis'],
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
    {
      id: 'systemic_lupus_erythematosus',
      label: 'Systemic Lupus Erythematosus',
      icon: '🦠',
      keywords: ['systemic lupus erythematosus'],
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
      id: 'acquired_immunodeficiency_syndrome',
      label: 'Acquired Immunodeficiency Syndrome (HIV Infection)',
      icon: '🦠',
      keywords: ['acquired immunodeficiency syndrome', 'hiv infection'],
    },
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
      id: 'shock_septic',
      label: 'Shock, Septic',
      icon: '⚠️',
      keywords: ['septic', 'septic shock', 'shock'],
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
      id: 'burn_injury',
      label: 'Burn Injury',
      icon: '🔥',
      keywords: ['burn injury'],
    },
    {
      id: 'cancer_of_the_skin',
      label: 'Cancer of the Skin (Malignant Melanoma)',
      icon: '🎗️',
      keywords: ['cancer of the skin', 'malignant melanoma'],
    },
    {
      id: 'contact_dermatitis',
      label: 'Contact Dermatitis',
      icon: '🧴',
      keywords: ['contact dermatitis'],
    },
    {
      id: 'eczema',
      label: 'Eczema & Dermatitis',
      icon: '🌿',
      keywords: ['eczema', 'dermatitis', 'atopic', 'emollient', 'calcineurin inhibitor'],
    },
    {
      id: 'exfoliative_dermatitis',
      label: 'Exfoliative Dermatitis',
      icon: '🧴',
      keywords: ['exfoliative dermatitis'],
    },
    {
      id: 'impetigo',
      label: 'Impetigo',
      icon: '🧴',
      keywords: ['impetigo'],
    },
    {
      id: 'pemphigus',
      label: 'Pemphigus',
      icon: '🧴',
      keywords: ['pemphigus'],
    },
    {
      id: 'pruritus',
      label: 'Pruritus',
      icon: '🧴',
      keywords: ['pruritus'],
    },
    {
      id: 'psoriasis',
      label: 'Psoriasis',
      icon: '🩹',
      keywords: ['psoriasis', 'psoriatic', 'calcipotriol'],
    },
    {
      id: 'seborrheic_dermatoses',
      label: 'Seborrheic Dermatoses',
      icon: '🧴',
      keywords: ['seborrheic dermatoses'],
    },
    {
      id: 'fungal_skin',
      label: 'Skin & Nail Fungal Infections',
      icon: '🍄',
      keywords: ['tinea', 'onychomycosis', 'ringworm', 'antifungal', 'topical antifungal'],
    },
    {
      id: 'toxic_epidermal_necrolysis_and_stevens_johnson_syndrome',
      label: 'Toxic Epidermal Necrolysis and Stevens-Johnson Syndrome',
      icon: '🧴',
      keywords: ['toxic epidermal necrolysis and stevens-johnson syndrome'],
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
      id: 'anemia',
      label: 'Anemia',
      icon: '🩸',
      keywords: ['anemia'],
    },
    {
      id: 'anemia_aplastic',
      label: 'Anemia, Aplastic',
      icon: '🩸',
      keywords: ['anemia', 'aplastic', 'aplastic anemia'],
    },
    {
      id: 'anemia_iron_deficiency',
      label: 'Anemia, Iron Deficiency',
      icon: '🩸',
      keywords: ['anemia', 'iron deficiency', 'iron deficiency anemia'],
    },
    {
      id: 'anemia_megaloblastic',
      label: 'Anemia, Megaloblastic (Vitamin B12 and Folic Acid Deficiency)',
      icon: '🩸',
      keywords: ['anemia', 'megaloblastic', 'folic acid deficiency', 'megaloblastic anemia', 'vitamin b12'],
    },
    {
      id: 'anemia_sickle_cell',
      label: 'Anemia, Sickle Cell',
      icon: '🩸',
      keywords: ['anemia', 'sickle cell', 'sickle cell anemia'],
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
      id: 'disseminated_intravascular_coagulation',
      label: 'Disseminated Intravascular Coagulation',
      icon: '🩸',
      keywords: ['disseminated intravascular coagulation'],
    },
    {
      id: 'hemophilia',
      label: 'Hemophilia',
      icon: '🩸',
      keywords: ['hemophilia'],
    },
    {
      id: 'hodgkins_disease',
      label: "Hodgkin's Disease",
      icon: '🎗️',
      keywords: ["hodgkin's disease"],
    },
    {
      id: 'idiopathic_thrombocytopenic_purpura',
      label: 'Idiopathic Thrombocytopenic Purpura',
      icon: '🩸',
      keywords: ['idiopathic thrombocytopenic purpura'],
    },
    {
      id: 'kaposis_sarcoma',
      label: "Kaposi's Sarcoma",
      icon: '🎗️',
      keywords: ["kaposi's sarcoma"],
    },
    {
      id: 'leukemia',
      label: 'Leukemia',
      icon: '🩸',
      keywords: ['leukemia'],
    },
    {
      id: 'leukemia_lymphocytic_acute',
      label: 'Leukemia, Lymphocytic, Acute',
      icon: '🩸',
      keywords: ['acute', 'acute lymphocytic leukemia', 'leukemia', 'lymphocytic'],
    },
    {
      id: 'leukemia_lymphocytic_chronic',
      label: 'Leukemia, Lymphocytic, Chronic',
      icon: '🩸',
      keywords: ['chronic', 'chronic lymphocytic leukemia', 'leukemia', 'lymphocytic'],
    },
    {
      id: 'leukemia_myeloid_acute',
      label: 'Leukemia, Myeloid, Acute',
      icon: '🩸',
      keywords: ['acute', 'acute myeloid leukemia', 'leukemia', 'myeloid'],
    },
    {
      id: 'leukemia_myeloid_chronic',
      label: 'Leukemia, Myeloid, Chronic',
      icon: '🩸',
      keywords: ['chronic', 'chronic myeloid leukemia', 'leukemia', 'myeloid'],
    },
    {
      id: 'lymphedema_and_elephantiasis',
      label: 'Lymphedema and Elephantiasis',
      icon: '🩸',
      keywords: ['lymphedema and elephantiasis'],
    },
    {
      id: 'multiple_myeloma',
      label: 'Multiple Myeloma',
      icon: '🎗️',
      keywords: ['multiple myeloma'],
    },
    {
      id: 'neutropenia',
      label: 'Neutropenia & Colony Stimulants',
      icon: '🛡️',
      keywords: ['neutropenia', 'colony-stimulating', 'granulocyte', 'g-csf'],
    },
    {
      id: 'polycythemia',
      label: 'Polycythemia',
      icon: '🩸',
      keywords: ['polycythemia'],
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
      id: 'benign_prostatic_hyperplasia_and_prostatectomy',
      label: 'Benign Prostatic Hyperplasia and Prostatectomy',
      icon: '🚻',
      keywords: ['benign prostatic hyperplasia and prostatectomy'],
    },
    {
      id: 'cancer_of_the_breast',
      label: 'Cancer of the Breast',
      icon: '🎗️',
      keywords: ['cancer of the breast'],
    },
    {
      id: 'cancer_of_the_cervix',
      label: 'Cancer of the Cervix',
      icon: '🎗️',
      keywords: ['cancer of the cervix'],
    },
    {
      id: 'cancer_of_the_endometrium',
      label: 'Cancer of the Endometrium',
      icon: '🎗️',
      keywords: ['cancer of the endometrium'],
    },
    {
      id: 'cancer_of_the_ovary',
      label: 'Cancer of the Ovary',
      icon: '🎗️',
      keywords: ['cancer of the ovary'],
    },
    {
      id: 'cancer_of_the_prostate',
      label: 'Cancer of the Prostate',
      icon: '🎗️',
      keywords: ['cancer of the prostate'],
    },
    {
      id: 'cancer_of_the_testis',
      label: 'Cancer of the Testis',
      icon: '🎗️',
      keywords: ['cancer of the testis'],
    },
    {
      id: 'cancer_of_the_vagina',
      label: 'Cancer of the Vagina',
      icon: '🎗️',
      keywords: ['cancer of the vagina'],
    },
    {
      id: 'cancer_of_the_vulva',
      label: 'Cancer of the Vulva',
      icon: '🎗️',
      keywords: ['cancer of the vulva'],
    },
    {
      id: 'contraception',
      label: 'Contraception',
      icon: '🛡️',
      keywords: ['contraceptive', 'contraception', 'oral contraceptive', 'emergency contraception', 'pill'],
    },
    {
      id: 'endometriosis',
      label: 'Endometriosis',
      icon: '🚻',
      keywords: ['endometriosis'],
    },
    {
      id: 'epididymitis',
      label: 'Epididymitis',
      icon: '🚻',
      keywords: ['epididymitis'],
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
      id: 'pelvic_infection',
      label: 'Pelvic Infection (Pelvic Inflammatory Disease)',
      icon: '🚻',
      keywords: ['pelvic infection', 'pelvic inflammatory disease'],
    },
    {
      id: 'prostatitis',
      label: 'Prostatitis',
      icon: '🚻',
      keywords: ['prostatitis'],
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
      id: 'cancer_of_the_larynx',
      label: 'Cancer of the Larynx',
      icon: '🎗️',
      keywords: ['cancer of the larynx'],
    },
    {
      id: 'cataract',
      label: 'Cataract',
      icon: '👁️',
      keywords: ['cataract'],
    },
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
      id: 'epistaxis',
      label: 'Epistaxis (Nosebleed)',
      icon: '👃',
      keywords: ['epistaxis', 'nosebleed'],
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
      id: 'mastoiditis_and_mastoid_surgery',
      label: 'Mastoiditis and Mastoid Surgery',
      icon: '👂',
      keywords: ['mastoiditis and mastoid surgery'],
    },
    {
      id: 'm_ni_res_disease',
      label: "Ménière's Disease",
      icon: '👂',
      keywords: ["ménière's disease"],
    },
    {
      id: 'nasal',
      label: 'Nasal & Sinus Disorders',
      icon: '👃',
      keywords: ['nasal', 'sinusitis', 'rhinitis', 'nasal polyp', 'decongestant nasal'],
    },
    {
      id: 'otitis_media_acute',
      label: 'Otitis Media, Acute',
      icon: '👂',
      keywords: ['acute', 'acute otitis media', 'otitis media'],
    },
    {
      id: 'otitis_media_chronic',
      label: 'Otitis Media, Chronic',
      icon: '👂',
      keywords: ['chronic', 'chronic otitis media', 'otitis media'],
    },
    {
      id: 'pharyngitis_acute',
      label: 'Pharyngitis, Acute',
      icon: '👂',
      keywords: ['acute', 'acute pharyngitis', 'pharyngitis'],
    },
    {
      id: 'pharyngitis_chronic',
      label: 'Pharyngitis, Chronic',
      icon: '👂',
      keywords: ['chronic', 'chronic pharyngitis', 'pharyngitis'],
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

};;;

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
export function groupDrugsByCondition(drugs, systemId, extraConditions = [], hiddenIds = []) {
  const baseConditions = SYSTEM_CONDITIONS[systemId] || [];
  const hidden = new Set(hiddenIds);
  const rawConditions = [...baseConditions, ...extraConditions].filter(c => !hidden.has(c.id));
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
