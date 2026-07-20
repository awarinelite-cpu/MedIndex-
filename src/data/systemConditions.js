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
      {
      id: 'aortic_aneurysm',
      label: 'Aortic Aneurysm',
      icon: '❤️',
      keywords: ['aortic aneurysm'],
    },
    {
      id: 'aortic_regurgitation',
      label: 'Aortic Regurgitation',
      icon: '❤️',
      keywords: ['aortic regurgitation'],
    },
    {
      id: 'aortitis',
      label: 'Aortitis',
      icon: '❤️',
      keywords: ['aortitis'],
    },
    {
      id: 'aortoiliac_disease',
      label: 'Aortoiliac Disease',
      icon: '❤️',
      keywords: ['aortoiliac disease'],
    },
    {
      id: 'arterial_embolism',
      label: 'Arterial Embolism',
      icon: '❤️',
      keywords: ['arterial embolism'],
    },
    {
      id: 'arterial_thrombosis',
      label: 'Arterial Thrombosis',
      icon: '❤️',
      keywords: ['arterial thrombosis'],
    },
    {
      id: 'arteriosclerosis',
      label: 'Arteriosclerosis',
      icon: '❤️',
      keywords: ['arteriosclerosis'],
    },
    {
      id: 'atherosclerosis',
      label: 'Atherosclerosis',
      icon: '❤️',
      keywords: ['atherosclerosis'],
    },
    {
      id: 'cardiac_tamponade',
      label: 'Cardiac Tamponade',
      icon: '❤️',
      keywords: ['cardiac tamponade'],
    },
    {
      id: 'cardiogenic_shock',
      label: 'Cardiogenic Shock',
      icon: '❤️',
      keywords: ['cardiogenic shock'],
    },
    {
      id: 'coronary_artery_disease',
      label: 'Coronary Artery Disease',
      icon: '❤️',
      keywords: ['coronary artery disease'],
    },
    {
      id: 'coronary_atherosclerosis',
      label: 'Coronary Atherosclerosis',
      icon: '❤️',
      keywords: ['coronary atherosclerosis'],
    },
    {
      id: 'dissecting_aorta',
      label: 'Dissecting Aorta',
      icon: '❤️',
      keywords: ['dissecting aorta'],
    },
    {
      id: 'dysrhythmias',
      label: 'Dysrhythmias',
      icon: '❤️',
      keywords: ['dysrhythmias'],
    },
    {
      id: 'heart_failure_2',
      label: 'Heart Failure (Acute/Chronic)',
      icon: '❤️',
      keywords: ['acute', 'chronic', 'heart failure', 'heart failure (acute/chronic)'],
    },
    {
      id: 'hypertension_2',
      label: 'Hypertension (Primary, Hypertensive Emergency, Hypertensive Urgency)',
      icon: '❤️',
      keywords: ['hypertension', 'hypertension (primary, hypertensive emergency, hypertensive urgency)', 'hypertensive emergency', 'hypertensive urgency', 'primary'],
    },
    {
      id: 'infective_endocarditis',
      label: 'Infective Endocarditis',
      icon: '❤️',
      keywords: ['infective endocarditis'],
    },
    {
      id: 'mitral_regurgitation_2',
      label: 'Mitral Regurgitation',
      icon: '❤️',
      keywords: ['mitral regurgitation'],
    },
    {
      id: 'myocardial_infarction',
      label: 'Myocardial Infarction',
      icon: '❤️',
      keywords: ['myocardial infarction'],
    },
    {
      id: 'myocardial_rupture',
      label: 'Myocardial Rupture',
      icon: '❤️',
      keywords: ['myocardial rupture'],
    },
    {
      id: 'pericardial_effusion',
      label: 'Pericardial Effusion',
      icon: '❤️',
      keywords: ['pericardial effusion'],
    },
    {
      id: 'pericarditis_2',
      label: 'Pericarditis',
      icon: '❤️',
      keywords: ['pericarditis'],
    },
    {
      id: 'raynaud_s_disease',
      label: 'Raynaud\'s Disease',
      icon: '❤️',
      keywords: ['raynaud\'s disease'],
    },
    {
      id: 'rheumatic_endocarditis',
      label: 'Rheumatic Endocarditis',
      icon: '❤️',
      keywords: ['rheumatic endocarditis'],
    },
    {
      id: 'thromboembolism_2',
      label: 'Thromboembolism',
      icon: '❤️',
      keywords: ['thromboembolism'],
    },
    {
      id: 'thromboangiitis_obliterans',
      label: 'Thromboangiitis Obliterans (Buerger\'s Disease)',
      icon: '❤️',
      keywords: ['buerger\'s disease', 'thromboangiitis obliterans', 'thromboangiitis obliterans (buerger\'s disease)'],
    },
    {
      id: 'valvular_heart_disorders',
      label: 'Valvular Heart Disorders',
      icon: '❤️',
      keywords: ['valvular heart disorders'],
    },
    {
      id: 'cellulitis',
      label: 'Cellulitis',
      icon: '❤️',
      keywords: ['cellulitis'],
    },
    {
      id: 'chronic_venous_insufficiency',
      label: 'Chronic Venous Insufficiency',
      icon: '❤️',
      keywords: ['chronic venous insufficiency'],
    },
    {
      id: 'deep_vein_thrombosis',
      label: 'Deep Vein Thrombosis (DVT)',
      icon: '❤️',
      keywords: ['deep vein thrombosis', 'deep vein thrombosis (dvt)', 'dvt'],
    },
    {
      id: 'elephantiasis',
      label: 'Elephantiasis',
      icon: '❤️',
      keywords: ['elephantiasis'],
    },
    {
      id: 'leg_ulcers',
      label: 'Leg Ulcers',
      icon: '❤️',
      keywords: ['leg ulcers'],
    },
    {
      id: 'lymphedema',
      label: 'Lymphedema',
      icon: '❤️',
      keywords: ['lymphedema'],
    },
    {
      id: 'lymphadenitis',
      label: 'Lymphadenitis',
      icon: '❤️',
      keywords: ['lymphadenitis'],
    },
    {
      id: 'lymphangitis',
      label: 'Lymphangitis',
      icon: '❤️',
      keywords: ['lymphangitis'],
    },
    {
      id: 'phlebothrombosis',
      label: 'Phlebothrombosis',
      icon: '❤️',
      keywords: ['phlebothrombosis'],
    },
    {
      id: 'thrombophlebitis',
      label: 'Thrombophlebitis',
      icon: '❤️',
      keywords: ['thrombophlebitis'],
    },
    {
      id: 'varicose_veins',
      label: 'Varicose Veins',
      icon: '❤️',
      keywords: ['varicose veins'],
    },
    {
      id: 'venous_thrombosis',
      label: 'Venous Thrombosis',
      icon: '❤️',
      keywords: ['venous thrombosis'],
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
      {
      id: 'acute_respiratory_distress_syndrome_2',
      label: 'Acute Respiratory Distress Syndrome (ARDS)',
      icon: '🫁',
      keywords: ['acute respiratory distress syndrome', 'acute respiratory distress syndrome (ards)', 'ards'],
    },
    {
      id: 'acute_respiratory_failure',
      label: 'Acute Respiratory Failure',
      icon: '🫁',
      keywords: ['acute respiratory failure'],
    },
    {
      id: 'acute_sinusitis',
      label: 'Acute Sinusitis',
      icon: '🫁',
      keywords: ['acute sinusitis'],
    },
    {
      id: 'acute_tracheobronchitis',
      label: 'Acute Tracheobronchitis',
      icon: '🫁',
      keywords: ['acute tracheobronchitis'],
    },
    {
      id: 'aspiration',
      label: 'Aspiration',
      icon: '🫁',
      keywords: ['aspiration'],
    },
    {
      id: 'asbestosis',
      label: 'Asbestosis',
      icon: '🫁',
      keywords: ['asbestosis'],
    },
    {
      id: 'atelectasis',
      label: 'Atelectasis',
      icon: '🫁',
      keywords: ['atelectasis'],
    },
    {
      id: 'chronic_pharyngitis',
      label: 'Chronic Pharyngitis',
      icon: '🫁',
      keywords: ['chronic pharyngitis'],
    },
    {
      id: 'chronic_sinusitis',
      label: 'Chronic Sinusitis',
      icon: '🫁',
      keywords: ['chronic sinusitis'],
    },
    {
      id: 'coal_workers_pneumoconiosis',
      label: 'Coal Workers\' Pneumoconiosis',
      icon: '🫁',
      keywords: ['coal workers\' pneumoconiosis'],
    },
    {
      id: 'common_cold',
      label: 'Common Cold (Viral Rhinitis)',
      icon: '🫁',
      keywords: ['common cold', 'common cold (viral rhinitis)', 'viral rhinitis'],
    },
    {
      id: 'cystic_fibrosis',
      label: 'Cystic Fibrosis',
      icon: '🫁',
      keywords: ['cystic fibrosis'],
    },
    {
      id: 'epistaxis_2',
      label: 'Epistaxis (Nosebleed)',
      icon: '🫁',
      keywords: ['epistaxis', 'epistaxis (nosebleed)', 'nosebleed'],
    },
    {
      id: 'laryngeal_obstruction',
      label: 'Laryngeal Obstruction',
      icon: '🫁',
      keywords: ['laryngeal obstruction'],
    },
    {
      id: 'laryngitis',
      label: 'Laryngitis',
      icon: '🫁',
      keywords: ['laryngitis'],
    },
    {
      id: 'lung_cancer',
      label: 'Lung Cancer (Bronchogenic Carcinoma)',
      icon: '🫁',
      keywords: ['bronchogenic carcinoma', 'lung cancer', 'lung cancer (bronchogenic carcinoma)'],
    },
    {
      id: 'nasal_obstruction',
      label: 'Nasal Obstruction',
      icon: '🫁',
      keywords: ['nasal obstruction'],
    },
    {
      id: 'nose_fractures',
      label: 'Nose Fractures',
      icon: '🫁',
      keywords: ['nose fractures'],
    },
    {
      id: 'obstruction_during_sleep',
      label: 'Obstruction During Sleep',
      icon: '🫁',
      keywords: ['obstruction during sleep'],
    },
    {
      id: 'pneumoconioses',
      label: 'Pneumoconioses',
      icon: '🫁',
      keywords: ['pneumoconioses'],
    },
    {
      id: 'pneumothorax',
      label: 'Pneumothorax',
      icon: '🫁',
      keywords: ['pneumothorax'],
    },
    {
      id: 'pulmonary_edema',
      label: 'Pulmonary Edema',
      icon: '🫁',
      keywords: ['pulmonary edema'],
    },
    {
      id: 'pulmonary_heart_disease_2',
      label: 'Pulmonary Heart Disease (Cor Pulmonale)',
      icon: '🫁',
      keywords: ['cor pulmonale', 'pulmonary heart disease', 'pulmonary heart disease (cor pulmonale)'],
    },
    {
      id: 'pulmonary_tuberculosis',
      label: 'Pulmonary Tuberculosis',
      icon: '🫁',
      keywords: ['pulmonary tuberculosis'],
    },
    {
      id: 'rhinitis',
      label: 'Rhinitis',
      icon: '🫁',
      keywords: ['rhinitis'],
    },
    {
      id: 'sarcoidosis',
      label: 'Sarcoidosis',
      icon: '🫁',
      keywords: ['sarcoidosis'],
    },
    {
      id: 'silicosis',
      label: 'Silicosis',
      icon: '🫁',
      keywords: ['silicosis'],
    },
    {
      id: 'status_asthmaticus',
      label: 'Status Asthmaticus',
      icon: '🫁',
      keywords: ['status asthmaticus'],
    },
    {
      id: 'tonsillitis_and_adenoiditis',
      label: 'Tonsillitis and Adenoiditis',
      icon: '🫁',
      keywords: ['tonsillitis and adenoiditis'],
    },
    {
      id: 'tumors_of_the_mediastinum',
      label: 'Tumors of the Mediastinum',
      icon: '🫁',
      keywords: ['tumors of the mediastinum'],
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
      {
      id: 'achalasia',
      label: 'Achalasia',
      icon: '🍽️',
      keywords: ['achalasia'],
    },
    {
      id: 'anal_fissure',
      label: 'Anal Fissure',
      icon: '🍽️',
      keywords: ['anal fissure'],
    },
    {
      id: 'anal_fistula',
      label: 'Anal Fistula',
      icon: '🍽️',
      keywords: ['anal fistula'],
    },
    {
      id: 'anorectal_abscess',
      label: 'Anorectal Abscess',
      icon: '🍽️',
      keywords: ['anorectal abscess'],
    },
    {
      id: 'barrett_s_esophagus',
      label: 'Barrett\'s Esophagus',
      icon: '🍽️',
      keywords: ['barrett\'s esophagus'],
    },
    {
      id: 'cancer_of_the_oral_cavity',
      label: 'Cancer of the Oral Cavity',
      icon: '🍽️',
      keywords: ['cancer of the oral cavity'],
    },
    {
      id: 'cholecystitis',
      label: 'Cholecystitis',
      icon: '🍽️',
      keywords: ['cholecystitis'],
    },
    {
      id: 'cholelithiasis_2',
      label: 'Cholelithiasis',
      icon: '🍽️',
      keywords: ['cholelithiasis'],
    },
    {
      id: 'chronic_pancreatitis',
      label: 'Chronic Pancreatitis',
      icon: '🍽️',
      keywords: ['chronic pancreatitis'],
    },
    {
      id: 'colorectal_cancer',
      label: 'Colorectal Cancer',
      icon: '🍽️',
      keywords: ['colorectal cancer'],
    },
    {
      id: 'crohn_s_disease',
      label: 'Crohn\'s Disease (Regional Enteritis)',
      icon: '🍽️',
      keywords: ['crohn\'s disease', 'crohn\'s disease (regional enteritis)', 'regional enteritis'],
    },
    {
      id: 'dental_caries',
      label: 'Dental Caries',
      icon: '🍽️',
      keywords: ['dental caries'],
    },
    {
      id: 'dental_plaque',
      label: 'Dental Plaque',
      icon: '🍽️',
      keywords: ['dental plaque'],
    },
    {
      id: 'diverticular_disease_diverticulitis',
      label: 'Diverticular Disease/Diverticulitis',
      icon: '🍽️',
      keywords: ['diverticular disease/diverticulitis'],
    },
    {
      id: 'dentoalveolar_abscess',
      label: 'Dentoalveolar Abscess',
      icon: '🍽️',
      keywords: ['dentoalveolar abscess'],
    },
    {
      id: 'dysphagia',
      label: 'Dysphagia',
      icon: '🍽️',
      keywords: ['dysphagia'],
    },
    {
      id: 'fecal_incontinence',
      label: 'Fecal Incontinence',
      icon: '🍽️',
      keywords: ['fecal incontinence'],
    },
    {
      id: 'foreign_bodies',
      label: 'Foreign Bodies (Esophageal)',
      icon: '🍽️',
      keywords: ['esophageal', 'foreign bodies', 'foreign bodies (esophageal)'],
    },
    {
      id: 'fulminant_hepatic_failure',
      label: 'Fulminant Hepatic Failure',
      icon: '🍽️',
      keywords: ['fulminant hepatic failure'],
    },
    {
      id: 'gastric_cancer',
      label: 'Gastric Cancer',
      icon: '🍽️',
      keywords: ['gastric cancer'],
    },
    {
      id: 'gastric_ulcers',
      label: 'Gastric Ulcers',
      icon: '🍽️',
      keywords: ['gastric ulcers'],
    },
    {
      id: 'gastroesophageal_reflux_disease',
      label: 'Gastroesophageal Reflux Disease (GERD)',
      icon: '🍽️',
      keywords: ['gastroesophageal reflux disease', 'gastroesophageal reflux disease (gerd)', 'gerd'],
    },
    {
      id: 'hemorrhoids',
      label: 'Hemorrhoids',
      icon: '🍽️',
      keywords: ['hemorrhoids'],
    },
    {
      id: 'irritable_bowel_syndrome',
      label: 'Irritable Bowel Syndrome',
      icon: '🍽️',
      keywords: ['irritable bowel syndrome'],
    },
    {
      id: 'malabsorption_conditions',
      label: 'Malabsorption Conditions',
      icon: '🍽️',
      keywords: ['malabsorption conditions'],
    },
    {
      id: 'malocclusion',
      label: 'Malocclusion',
      icon: '🍽️',
      keywords: ['malocclusion'],
    },
    {
      id: 'morbid_obesity',
      label: 'Morbid Obesity',
      icon: '🍽️',
      keywords: ['morbid obesity'],
    },
    {
      id: 'pancreatic_cysts',
      label: 'Pancreatic Cysts',
      icon: '🍽️',
      keywords: ['pancreatic cysts'],
    },
    {
      id: 'pancreatic_islet_tumors',
      label: 'Pancreatic Islet Tumors',
      icon: '🍽️',
      keywords: ['pancreatic islet tumors'],
    },
    {
      id: 'parotitis',
      label: 'Parotitis',
      icon: '🍽️',
      keywords: ['parotitis'],
    },
    {
      id: 'perforation',
      label: 'Perforation (Esophageal)',
      icon: '🍽️',
      keywords: ['esophageal', 'perforation', 'perforation (esophageal)'],
    },
    {
      id: 'periapical_abscess',
      label: 'Periapical Abscess',
      icon: '🍽️',
      keywords: ['periapical abscess'],
    },
    {
      id: 'pilonidal_sinus_cyst',
      label: 'Pilonidal Sinus/Cyst',
      icon: '🍽️',
      keywords: ['pilonidal sinus/cyst'],
    },
    {
      id: 'polyps',
      label: 'Polyps (Colon and Rectum)',
      icon: '🍽️',
      keywords: ['colon and rectum', 'polyps', 'polyps (colon and rectum)'],
    },
    {
      id: 'salivary_calculus',
      label: 'Salivary Calculus (Sialolithiasis)',
      icon: '🍽️',
      keywords: ['salivary calculus', 'salivary calculus (sialolithiasis)', 'sialolithiasis'],
    },
    {
      id: 'sialadenitis',
      label: 'Sialadenitis',
      icon: '🍽️',
      keywords: ['sialadenitis'],
    },
    {
      id: 'temporomandibular_disorders',
      label: 'Temporomandibular Disorders',
      icon: '🍽️',
      keywords: ['temporomandibular disorders'],
    },
    {
      id: 'toxic_hepatitis',
      label: 'Toxic Hepatitis',
      icon: '🍽️',
      keywords: ['toxic hepatitis'],
    },
    {
      id: 'drug_induced_hepatitis',
      label: 'Drug-Induced Hepatitis',
      icon: '🍽️',
      keywords: ['drug-induced hepatitis'],
    },
    {
      id: 'viral_hepatitis',
      label: 'Viral Hepatitis (HAV, HBV, HCV, HDV, HEV, HGV/GBV-C)',
      icon: '🍽️',
      keywords: ['gbv-c', 'hav', 'hbv', 'hcv', 'hdv', 'hev', 'hgv', 'viral hepatitis', 'viral hepatitis (hav, hbv, hcv, hdv, hev, hgv/gbv-c)'],
    },
    {
      id: 'ascites',
      label: 'Ascites',
      icon: '🍽️',
      keywords: ['ascites'],
    },
    {
      id: 'esophageal_varices',
      label: 'Esophageal Varices',
      icon: '🍽️',
      keywords: ['esophageal varices'],
    },
    {
      id: 'hepatic_encephalopathy',
      label: 'Hepatic Encephalopathy',
      icon: '🍽️',
      keywords: ['hepatic encephalopathy'],
    },
    {
      id: 'jaundice',
      label: 'Jaundice',
      icon: '🍽️',
      keywords: ['jaundice'],
    },
    {
      id: 'liver_abscesses',
      label: 'Liver Abscesses',
      icon: '🍽️',
      keywords: ['liver abscesses'],
    },
    {
      id: 'liver_metastases',
      label: 'Liver Metastases',
      icon: '🍽️',
      keywords: ['liver metastases'],
    },
    {
      id: 'portal_hypertension',
      label: 'Portal Hypertension',
      icon: '🍽️',
      keywords: ['portal hypertension'],
    },
    {
      id: 'primary_liver_tumors',
      label: 'Primary Liver Tumors',
      icon: '🍽️',
      keywords: ['primary liver tumors'],
    },
    {
      id: 'tumors_of_the_head_of_the_pancreas',
      label: 'Tumors of the Head of the Pancreas',
      icon: '🍽️',
      keywords: ['tumors of the head of the pancreas'],
    },
    {
      id: 'liver_disease',
      label: 'Liver Disease',
      icon: '🍽️',
      keywords: ['liver disease'],
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
      {
      id: 'acute_glomerulonephritis',
      label: 'Acute Glomerulonephritis',
      icon: '🚰',
      keywords: ['acute glomerulonephritis'],
    },
    {
      id: 'acute_pyelonephritis',
      label: 'Acute Pyelonephritis',
      icon: '🚰',
      keywords: ['acute pyelonephritis'],
    },
    {
      id: 'acute_renal_failure',
      label: 'Acute Renal Failure',
      icon: '🚰',
      keywords: ['acute renal failure'],
    },
    {
      id: 'bladder_trauma',
      label: 'Bladder Trauma',
      icon: '🚰',
      keywords: ['bladder trauma'],
    },
    {
      id: 'cancer_of_the_kidney',
      label: 'Cancer of the Kidney',
      icon: '🚰',
      keywords: ['cancer of the kidney'],
    },
    {
      id: 'chronic_glomerulonephritis',
      label: 'Chronic Glomerulonephritis',
      icon: '🚰',
      keywords: ['chronic glomerulonephritis'],
    },
    {
      id: 'chronic_pyelonephritis',
      label: 'Chronic Pyelonephritis',
      icon: '🚰',
      keywords: ['chronic pyelonephritis'],
    },
    {
      id: 'chronic_renal_failure',
      label: 'Chronic Renal Failure (End-Stage Renal Disease)',
      icon: '🚰',
      keywords: ['chronic renal failure', 'chronic renal failure (end-stage renal disease)', 'end-stage renal disease'],
    },
    {
      id: 'congenital_voiding_dysfunction',
      label: 'Congenital Voiding Dysfunction',
      icon: '🚰',
      keywords: ['congenital voiding dysfunction'],
    },
    {
      id: 'adult_voiding_dysfunction',
      label: 'Adult Voiding Dysfunction',
      icon: '🚰',
      keywords: ['adult voiding dysfunction'],
    },
    {
      id: 'lower_urinary_tract_infections',
      label: 'Lower Urinary Tract Infections',
      icon: '🚰',
      keywords: ['lower urinary tract infections'],
    },
    {
      id: 'neurogenic_bladder',
      label: 'Neurogenic Bladder',
      icon: '🚰',
      keywords: ['neurogenic bladder'],
    },
    {
      id: 'renal_trauma',
      label: 'Renal Trauma',
      icon: '🚰',
      keywords: ['renal trauma'],
    },
    {
      id: 'ureteral_trauma',
      label: 'Ureteral Trauma',
      icon: '🚰',
      keywords: ['ureteral trauma'],
    },
    {
      id: 'urethral_trauma',
      label: 'Urethral Trauma',
      icon: '🚰',
      keywords: ['urethral trauma'],
    },
    {
      id: 'urinary_incontinence',
      label: 'Urinary Incontinence',
      icon: '🚰',
      keywords: ['urinary incontinence'],
    },
    {
      id: 'urinary_retention',
      label: 'Urinary Retention',
      icon: '🚰',
      keywords: ['urinary retention'],
    },
    {
      id: 'urolithiasis_2',
      label: 'Urolithiasis (Kidney Stones)',
      icon: '🚰',
      keywords: ['kidney stones', 'urolithiasis', 'urolithiasis (kidney stones)'],
    },
    {
      id: 'acid_base_disturbances',
      label: 'Acid-Base Disturbances (Metabolic/Respiratory Acidosis/Alkalosis)',
      icon: '🚰',
      keywords: ['acid-base disturbances', 'acid-base disturbances (metabolic/respiratory acidosis/alkalosis)', 'alkalosis', 'metabolic', 'respiratory acidosis'],
    },
    {
      id: 'fluid_and_electrolyte_disturbances',
      label: 'Fluid and Electrolyte Disturbances',
      icon: '🚰',
      keywords: ['fluid and electrolyte disturbances'],
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
      {
      id: 'addison_s_disease',
      label: 'Addison\'s Disease (Adrenocortical Insufficiency)',
      icon: '⚙️',
      keywords: ['addison\'s disease', 'addison\'s disease (adrenocortical insufficiency)', 'adrenocortical insufficiency'],
    },
    {
      id: 'cushing_s_syndrome',
      label: 'Cushing\'s Syndrome',
      icon: '⚙️',
      keywords: ['cushing\'s syndrome'],
    },
    {
      id: 'diabetes_mellitus',
      label: 'Diabetes Mellitus (Type 1, Type 2, Gestational)',
      icon: '⚙️',
      keywords: ['diabetes mellitus', 'diabetes mellitus (type 1, type 2, gestational)', 'gestational', 'type 1', 'type 2'],
    },
    {
      id: 'hyperinsulinism',
      label: 'Hyperinsulinism',
      icon: '⚙️',
      keywords: ['hyperinsulinism'],
    },
    {
      id: 'hyperparathyroidism',
      label: 'Hyperparathyroidism',
      icon: '⚙️',
      keywords: ['hyperparathyroidism'],
    },
    {
      id: 'hyperthyroidism_2',
      label: 'Hyperthyroidism',
      icon: '⚙️',
      keywords: ['hyperthyroidism'],
    },
    {
      id: 'hypothyroidism',
      label: 'Hypothyroidism',
      icon: '⚙️',
      keywords: ['hypothyroidism'],
    },
    {
      id: 'syndrome_of_inappropriate_antidiuretic_hormone_secretion_2',
      label: 'Syndrome of Inappropriate Antidiuretic Hormone Secretion (SIADH)',
      icon: '⚙️',
      keywords: ['siadh', 'syndrome of inappropriate antidiuretic hormone secretion', 'syndrome of inappropriate antidiuretic hormone secretion (siadh)'],
    },
    {
      id: 'thyroid_cancer',
      label: 'Thyroid Cancer',
      icon: '⚙️',
      keywords: ['thyroid cancer'],
    },
    {
      id: 'thyroiditis',
      label: 'Thyroiditis',
      icon: '⚙️',
      keywords: ['thyroiditis'],
    },
    {
      id: 'thyroid_tumors',
      label: 'Thyroid Tumors',
      icon: '⚙️',
      keywords: ['thyroid tumors'],
    },
    {
      id: 'ulcerogenic_tumors',
      label: 'Ulcerogenic Tumors',
      icon: '⚙️',
      keywords: ['ulcerogenic tumors'],
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
      {
      id: 'acoustic_neuroma',
      label: 'Acoustic Neuroma',
      icon: '🧠',
      keywords: ['acoustic neuroma'],
    },
    {
      id: 'altered_level_of_consciousness',
      label: 'Altered Level of Consciousness',
      icon: '🧠',
      keywords: ['altered level of consciousness'],
    },
    {
      id: 'alzheimer_s_disease',
      label: 'Alzheimer\'s Disease',
      icon: '🧠',
      keywords: ['alzheimer\'s disease'],
    },
    {
      id: 'amyotrophic_lateral_sclerosis_2',
      label: 'Amyotrophic Lateral Sclerosis (ALS)',
      icon: '🧠',
      keywords: ['als', 'amyotrophic lateral sclerosis', 'amyotrophic lateral sclerosis (als)'],
    },
    {
      id: 'arthropod_borne_virus_encephalitis',
      label: 'Arthropod-Borne Virus Encephalitis',
      icon: '🧠',
      keywords: ['arthropod-borne virus encephalitis'],
    },
    {
      id: 'bell_s_palsy',
      label: 'Bell\'s Palsy',
      icon: '🧠',
      keywords: ['bell\'s palsy'],
    },
    {
      id: 'benign_paroxysmal_positional_vertigo',
      label: 'Benign Paroxysmal Positional Vertigo',
      icon: '🧠',
      keywords: ['benign paroxysmal positional vertigo'],
    },
    {
      id: 'brain_injury',
      label: 'Brain Injury',
      icon: '🧠',
      keywords: ['brain injury'],
    },
    {
      id: 'cerebral_metastases',
      label: 'Cerebral Metastases',
      icon: '🧠',
      keywords: ['cerebral metastases'],
    },
    {
      id: 'chronic_confusion',
      label: 'Chronic Confusion',
      icon: '🧠',
      keywords: ['chronic confusion'],
    },
    {
      id: 'creutzfeldt_jakob_disease',
      label: 'Creutzfeldt-Jakob Disease',
      icon: '🧠',
      keywords: ['creutzfeldt-jakob disease'],
    },
    {
      id: 'degenerative_disk_disease_2',
      label: 'Degenerative Disk Disease',
      icon: '🧠',
      keywords: ['degenerative disk disease'],
    },
    {
      id: 'epilepsy_2',
      label: 'Epilepsy',
      icon: '🧠',
      keywords: ['epilepsy'],
    },
    {
      id: 'fungal_encephalitis',
      label: 'Fungal Encephalitis',
      icon: '🧠',
      keywords: ['fungal encephalitis'],
    },
    {
      id: 'guillain_barr_syndrome_2',
      label: 'Guillain-Barré Syndrome',
      icon: '🧠',
      keywords: ['guillain-barré syndrome'],
    },
    {
      id: 'head_injuries',
      label: 'Head Injuries',
      icon: '🧠',
      keywords: ['head injuries'],
    },
    {
      id: 'hemorrhagic_stroke',
      label: 'Hemorrhagic Stroke',
      icon: '🧠',
      keywords: ['hemorrhagic stroke'],
    },
    {
      id: 'herpes_simplex_virus_encephalitis',
      label: 'Herpes Simplex Virus Encephalitis',
      icon: '🧠',
      keywords: ['herpes simplex virus encephalitis'],
    },
    {
      id: 'huntington_s_disease',
      label: 'Huntington\'s Disease',
      icon: '🧠',
      keywords: ['huntington\'s disease'],
    },
    {
      id: 'ischemic_stroke',
      label: 'Ischemic Stroke',
      icon: '🧠',
      keywords: ['ischemic stroke'],
    },
    {
      id: 'labyrinthitis',
      label: 'Labyrinthitis',
      icon: '🧠',
      keywords: ['labyrinthitis'],
    },
    {
      id: 'm_ni_re_s_disease',
      label: 'Ménière\'s Disease',
      icon: '🧠',
      keywords: ['ménière\'s disease'],
    },
    {
      id: 'mononeuropathy',
      label: 'Mononeuropathy',
      icon: '🧠',
      keywords: ['mononeuropathy'],
    },
    {
      id: 'motion_sickness',
      label: 'Motion Sickness',
      icon: '🧠',
      keywords: ['motion sickness'],
    },
    {
      id: 'muscular_dystrophies_2',
      label: 'Muscular Dystrophies',
      icon: '🧠',
      keywords: ['muscular dystrophies'],
    },
    {
      id: 'new_variant_creutzfeldt_jakob_disease',
      label: 'New-Variant Creutzfeldt-Jakob Disease',
      icon: '🧠',
      keywords: ['new-variant creutzfeldt-jakob disease'],
    },
    {
      id: 'ototoxicity',
      label: 'Ototoxicity',
      icon: '🧠',
      keywords: ['ototoxicity'],
    },
    {
      id: 'parkinson_s_disease',
      label: 'Parkinson\'s Disease',
      icon: '🧠',
      keywords: ['parkinson\'s disease'],
    },
    {
      id: 'peripheral_neuropathies',
      label: 'Peripheral Neuropathies',
      icon: '🧠',
      keywords: ['peripheral neuropathies'],
    },
    {
      id: 'post_polio_syndrome_2',
      label: 'Post-Polio Syndrome',
      icon: '🧠',
      keywords: ['post-polio syndrome'],
    },
    {
      id: 'post_trauma_syndrome',
      label: 'Post-Trauma Syndrome',
      icon: '🧠',
      keywords: ['post-trauma syndrome'],
    },
    {
      id: 'primary_brain_tumors',
      label: 'Primary Brain Tumors',
      icon: '🧠',
      keywords: ['primary brain tumors'],
    },
    {
      id: 'quadriplegia_paraplegia',
      label: 'Quadriplegia/Paraplegia',
      icon: '🧠',
      keywords: ['quadriplegia/paraplegia'],
    },
    {
      id: 'seizure_disorders',
      label: 'Seizure Disorders',
      icon: '🧠',
      keywords: ['seizure disorders'],
    },
    {
      id: 'spinal_cord_tumors',
      label: 'Spinal Cord Tumors',
      icon: '🧠',
      keywords: ['spinal cord tumors'],
    },
    {
      id: 'status_epilepticus',
      label: 'Status Epilepticus',
      icon: '🧠',
      keywords: ['status epilepticus'],
    },
    {
      id: 'sleep_disorders',
      label: 'Sleep Disorders',
      icon: '🧠',
      keywords: ['sleep disorders'],
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
      {
      id: 'acute_low_back_pain',
      label: 'Acute Low Back Pain',
      icon: '🦴',
      keywords: ['acute low back pain'],
    },
    {
      id: 'amputation',
      label: 'Amputation',
      icon: '🦴',
      keywords: ['amputation'],
    },
    {
      id: 'ankylosing_spondylitis',
      label: 'Ankylosing Spondylitis',
      icon: '🦴',
      keywords: ['ankylosing spondylitis'],
    },
    {
      id: 'anterior_cruciate_ligament_injury',
      label: 'Anterior Cruciate Ligament Injury',
      icon: '🦴',
      keywords: ['anterior cruciate ligament injury'],
    },
    {
      id: 'avascular_necrosis_of_bone',
      label: 'Avascular Necrosis of Bone',
      icon: '🦴',
      keywords: ['avascular necrosis of bone'],
    },
    {
      id: 'benign_bone_tumors',
      label: 'Benign Bone Tumors',
      icon: '🦴',
      keywords: ['benign bone tumors'],
    },
    {
      id: 'bone_tumors_2',
      label: 'Bone Tumors (Malignant)',
      icon: '🦴',
      keywords: ['bone tumors', 'bone tumors (malignant)', 'malignant'],
    },
    {
      id: 'bursitis',
      label: 'Bursitis',
      icon: '🦴',
      keywords: ['bursitis'],
    },
    {
      id: 'carpal_tunnel_syndrome',
      label: 'Carpal Tunnel Syndrome',
      icon: '🦴',
      keywords: ['carpal tunnel syndrome'],
    },
    {
      id: 'compartment_syndrome',
      label: 'Compartment Syndrome',
      icon: '🦴',
      keywords: ['compartment syndrome'],
    },
    {
      id: 'complex_regional_pain_syndrome',
      label: 'Complex Regional Pain Syndrome',
      icon: '🦴',
      keywords: ['complex regional pain syndrome'],
    },
    {
      id: 'contusions',
      label: 'Contusions',
      icon: '🦴',
      keywords: ['contusions'],
    },
    {
      id: 'degenerative_disk_disease',
      label: 'Degenerative Disk Disease',
      icon: '🦴',
      keywords: ['degenerative disk disease'],
    },
    {
      id: 'delayed_union',
      label: 'Delayed Union',
      icon: '🦴',
      keywords: ['delayed union'],
    },
    {
      id: 'dupuytren_s_contracture',
      label: 'Dupuytren\'s Contracture',
      icon: '🦴',
      keywords: ['dupuytren\'s contracture'],
    },
    {
      id: 'epicondylitis',
      label: 'Epicondylitis (Tennis Elbow)',
      icon: '🦴',
      keywords: ['epicondylitis', 'epicondylitis (tennis elbow)', 'tennis elbow'],
    },
    {
      id: 'fat_embolism_syndrome',
      label: 'Fat Embolism Syndrome',
      icon: '🦴',
      keywords: ['fat embolism syndrome'],
    },
    {
      id: 'fibromyalgia_2',
      label: 'Fibromyalgia',
      icon: '🦴',
      keywords: ['fibromyalgia'],
    },
    {
      id: 'flatfoot',
      label: 'Flatfoot',
      icon: '🦴',
      keywords: ['flatfoot'],
    },
    {
      id: 'fractures_2',
      label: 'Fractures (Clavicle, Elbow, Femoral Shaft, Femur, Hand, Humeral Neck, Humeral Shaft, Pelvis, Rib, Radial Head, Radial/Ulnar Shafts, Thoracolumbar Spine, Tibia/Fibula, Wrist)',
      icon: '🦴',
      keywords: ['clavicle', 'elbow', 'femoral shaft', 'femur', 'fibula', 'fractures', 'fractures (clavicle, elbow, femoral shaft, femur, hand, humeral neck, humeral shaft, pelvis, rib, radial head, radial/ulnar shafts, thoracolumbar spine, tibia/fibula, wrist)', 'hand', 'humeral neck', 'humeral shaft', 'pelvis', 'radial', 'radial head', 'rib', 'thoracolumbar spine', 'tibia', 'ulnar shafts', 'wrist'],
    },
    {
      id: 'ganglion',
      label: 'Ganglion',
      icon: '🦴',
      keywords: ['ganglion'],
    },
    {
      id: 'gout_2',
      label: 'Gout',
      icon: '🦴',
      keywords: ['gout'],
    },
    {
      id: 'hallux_valgus',
      label: 'Hallux Valgus',
      icon: '🦴',
      keywords: ['hallux valgus'],
    },
    {
      id: 'hammer_toe',
      label: 'Hammer Toe',
      icon: '🦴',
      keywords: ['hammer toe'],
    },
    {
      id: 'herniation_of_cervical_intervertebral_disk',
      label: 'Herniation of Cervical Intervertebral Disk',
      icon: '🦴',
      keywords: ['herniation of cervical intervertebral disk'],
    },
    {
      id: 'herniation_of_lumbar_disk',
      label: 'Herniation of Lumbar Disk',
      icon: '🦴',
      keywords: ['herniation of lumbar disk'],
    },
    {
      id: 'heterotrophic_ossification',
      label: 'Heterotrophic Ossification',
      icon: '🦴',
      keywords: ['heterotrophic ossification'],
    },
    {
      id: 'impingement_syndrome',
      label: 'Impingement Syndrome',
      icon: '🦴',
      keywords: ['impingement syndrome'],
    },
    {
      id: 'ingrown_toenail',
      label: 'Ingrown Toenail',
      icon: '🦴',
      keywords: ['ingrown toenail'],
    },
    {
      id: 'joint_dislocations',
      label: 'Joint Dislocations',
      icon: '🦴',
      keywords: ['joint dislocations'],
    },
    {
      id: 'lateral_collateral_ligament_injury',
      label: 'Lateral Collateral Ligament Injury',
      icon: '🦴',
      keywords: ['lateral collateral ligament injury'],
    },
    {
      id: 'loose_bodies',
      label: 'Loose Bodies',
      icon: '🦴',
      keywords: ['loose bodies'],
    },
    {
      id: 'malignant_bone_tumors',
      label: 'Malignant Bone Tumors',
      icon: '🦴',
      keywords: ['malignant bone tumors'],
    },
    {
      id: 'medial_collateral_ligament_injury',
      label: 'Medial Collateral Ligament Injury',
      icon: '🦴',
      keywords: ['medial collateral ligament injury'],
    },
    {
      id: 'meniscal_injuries',
      label: 'Meniscal Injuries',
      icon: '🦴',
      keywords: ['meniscal injuries'],
    },
    {
      id: 'metastatic_bone_disease',
      label: 'Metastatic Bone Disease',
      icon: '🦴',
      keywords: ['metastatic bone disease'],
    },
    {
      id: 'morton_s_neuroma',
      label: 'Morton\'s Neuroma',
      icon: '🦴',
      keywords: ['morton\'s neuroma'],
    },
    {
      id: 'nonunion',
      label: 'Nonunion',
      icon: '🦴',
      keywords: ['nonunion'],
    },
    {
      id: 'osteoarthritis_2',
      label: 'Osteoarthritis',
      icon: '🦴',
      keywords: ['osteoarthritis'],
    },
    {
      id: 'paget_s_disease',
      label: 'Paget\'s Disease',
      icon: '🦴',
      keywords: ['paget\'s disease'],
    },
    {
      id: 'pes_cavus',
      label: 'Pes Cavus',
      icon: '🦴',
      keywords: ['pes cavus'],
    },
    {
      id: 'plantar_fasciitis',
      label: 'Plantar Fasciitis',
      icon: '🦴',
      keywords: ['plantar fasciitis'],
    },
    {
      id: 'posterior_cruciate_ligament_injury',
      label: 'Posterior Cruciate Ligament Injury',
      icon: '🦴',
      keywords: ['posterior cruciate ligament injury'],
    },
    {
      id: 'post_polio_syndrome',
      label: 'Post-Polio Syndrome',
      icon: '🦴',
      keywords: ['post-polio syndrome'],
    },
    {
      id: 'psoriatic_arthritis',
      label: 'Psoriatic Arthritis',
      icon: '🦴',
      keywords: ['psoriatic arthritis'],
    },
    {
      id: 'reactive_arthritis',
      label: 'Reactive Arthritis (Reiter\'s Syndrome)',
      icon: '🦴',
      keywords: ['reactive arthritis', 'reactive arthritis (reiter\'s syndrome)', 'reiter\'s syndrome'],
    },
    {
      id: 'rheumatoid_arthritis',
      label: 'Rheumatoid Arthritis',
      icon: '🦴',
      keywords: ['rheumatoid arthritis'],
    },
    {
      id: 'rotator_cuff_tears',
      label: 'Rotator Cuff Tears',
      icon: '🦴',
      keywords: ['rotator cuff tears'],
    },
    {
      id: 'rupture_of_achilles_tendon',
      label: 'Rupture of Achilles Tendon',
      icon: '🦴',
      keywords: ['rupture of achilles tendon'],
    },
    {
      id: 'septic_arthritis',
      label: 'Septic (Infectious) Arthritis',
      icon: '🦴',
      keywords: ['infectious', 'septic  arthritis', 'septic (infectious) arthritis'],
    },
    {
      id: 'spondyloarthropathies',
      label: 'Spondyloarthropathies',
      icon: '🦴',
      keywords: ['spondyloarthropathies'],
    },
    {
      id: 'sprains',
      label: 'Sprains',
      icon: '🦴',
      keywords: ['sprains'],
    },
    {
      id: 'strains',
      label: 'Strains',
      icon: '🦴',
      keywords: ['strains'],
    },
    {
      id: 'tendinitis',
      label: 'Tendinitis',
      icon: '🦴',
      keywords: ['tendinitis'],
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
      {
      id: 'acute_alcohol_intoxication',
      label: 'Acute Alcohol Intoxication',
      icon: '💭',
      keywords: ['acute alcohol intoxication'],
    },
    {
      id: 'alcohol_withdrawal_syndrome',
      label: 'Alcohol Withdrawal Syndrome',
      icon: '💭',
      keywords: ['alcohol withdrawal syndrome'],
    },
    {
      id: 'anxiety_2',
      label: 'Anxiety',
      icon: '💭',
      keywords: ['anxiety'],
    },
    {
      id: 'delirium',
      label: 'Delirium',
      icon: '💭',
      keywords: ['delirium'],
    },
    {
      id: 'delirium_tremens',
      label: 'Delirium Tremens',
      icon: '💭',
      keywords: ['delirium tremens'],
    },
    {
      id: 'dementias',
      label: 'Dementias (Multi-Infarct, Alzheimer\'s)',
      icon: '💭',
      keywords: ['alzheimer\'s', 'dementias', 'dementias (multi-infarct, alzheimer\'s)', 'multi-infarct'],
    },
    {
      id: 'overactive_patients',
      label: 'Overactive Patients',
      icon: '💭',
      keywords: ['overactive patients'],
    },
    {
      id: 'posttraumatic_stress_disorder',
      label: 'Posttraumatic Stress Disorder',
      icon: '💭',
      keywords: ['posttraumatic stress disorder'],
    },
    {
      id: 'psychiatric_emergencies',
      label: 'Psychiatric Emergencies',
      icon: '💭',
      keywords: ['psychiatric emergencies'],
    },
    {
      id: 'substance_abuse',
      label: 'Substance Abuse',
      icon: '💭',
      keywords: ['substance abuse'],
    },
    {
      id: 'suicidal_patients',
      label: 'Suicidal Patients',
      icon: '💭',
      keywords: ['suicidal patients'],
    },
    {
      id: 'underactive_depressed_patients',
      label: 'Underactive/Depressed Patients',
      icon: '💭',
      keywords: ['underactive/depressed patients'],
    },
    {
      id: 'violent_behavior',
      label: 'Violent Behavior',
      icon: '💭',
      keywords: ['violent behavior'],
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
      {
      id: 'acquired_immunodeficiency_syndrome_2',
      label: 'Acquired Immunodeficiency Syndrome (AIDS)',
      icon: '🦠',
      keywords: ['acquired immunodeficiency syndrome', 'acquired immunodeficiency syndrome (aids)', 'aids'],
    },
    {
      id: 'allergic_rhinitis',
      label: 'Allergic Rhinitis',
      icon: '🦠',
      keywords: ['allergic rhinitis'],
    },
    {
      id: 'anaphylaxis_2',
      label: 'Anaphylaxis',
      icon: '🦠',
      keywords: ['anaphylaxis'],
    },
    {
      id: 'angioneurotic_edema',
      label: 'Angioneurotic Edema',
      icon: '🦠',
      keywords: ['angioneurotic edema'],
    },
    {
      id: 'atopic_dermatitis_2',
      label: 'Atopic Dermatitis',
      icon: '🦠',
      keywords: ['atopic dermatitis'],
    },
    {
      id: 'b_cell_deficiencies',
      label: 'B-Cell Deficiencies',
      icon: '🦠',
      keywords: ['b-cell deficiencies'],
    },
    {
      id: 'combined_b_cell_and_t_cell_deficiencies',
      label: 'Combined B-Cell and T-Cell Deficiencies',
      icon: '🦠',
      keywords: ['combined b-cell and t-cell deficiencies'],
    },
    {
      id: 'complement_system_deficiencies',
      label: 'Complement System Deficiencies',
      icon: '🦠',
      keywords: ['complement system deficiencies'],
    },
    {
      id: 'contact_dermatitis_2',
      label: 'Contact Dermatitis',
      icon: '🦠',
      keywords: ['contact dermatitis'],
    },
    {
      id: 'dermatitis_medicamentosa_2',
      label: 'Dermatitis Medicamentosa',
      icon: '🦠',
      keywords: ['dermatitis medicamentosa'],
    },
    {
      id: 'food_allergy',
      label: 'Food Allergy',
      icon: '🦠',
      keywords: ['food allergy'],
    },
    {
      id: 'hereditary_angioedema',
      label: 'Hereditary Angioedema',
      icon: '🦠',
      keywords: ['hereditary angioedema'],
    },
    {
      id: 'hiv_infection',
      label: 'HIV Infection',
      icon: '🦠',
      keywords: ['hiv infection'],
    },
    {
      id: 'latex_allergy_2',
      label: 'Latex Allergy',
      icon: '🦠',
      keywords: ['latex allergy'],
    },
    {
      id: 'phagocytic_dysfunction',
      label: 'Phagocytic Dysfunction',
      icon: '🦠',
      keywords: ['phagocytic dysfunction'],
    },
    {
      id: 'secondary_immunodeficiencies',
      label: 'Secondary Immunodeficiencies',
      icon: '🦠',
      keywords: ['secondary immunodeficiencies'],
    },
    {
      id: 'serum_sickness',
      label: 'Serum Sickness',
      icon: '🦠',
      keywords: ['serum sickness'],
    },
    {
      id: 't_cell_deficiencies',
      label: 'T-Cell Deficiencies',
      icon: '🦠',
      keywords: ['t-cell deficiencies'],
    },
    {
      id: 'urticaria_3',
      label: 'Urticaria',
      icon: '🦠',
      keywords: ['urticaria'],
    },
    {
      id: 'ebola_virus',
      label: 'Ebola Virus',
      icon: '🦠',
      keywords: ['ebola virus'],
    },
    {
      id: 'emerging_infectious_diseases',
      label: 'Emerging Infectious Diseases',
      icon: '🦠',
      keywords: ['emerging infectious diseases'],
    },
    {
      id: 'hantavirus_pulmonary_syndrome',
      label: 'Hantavirus Pulmonary Syndrome',
      icon: '🦠',
      keywords: ['hantavirus pulmonary syndrome'],
    },
    {
      id: 'legionnaires_disease',
      label: 'Legionnaires\' Disease',
      icon: '🦠',
      keywords: ['legionnaires\' disease'],
    },
    {
      id: 'lyme_disease',
      label: 'Lyme Disease',
      icon: '🦠',
      keywords: ['lyme disease'],
    },
    {
      id: 'marburg_virus',
      label: 'Marburg Virus',
      icon: '🦠',
      keywords: ['marburg virus'],
    },
    {
      id: 'west_nile_virus',
      label: 'West Nile Virus',
      icon: '🦠',
      keywords: ['west nile virus'],
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
      {
      id: 'acne_vulgaris',
      label: 'Acne Vulgaris',
      icon: '🧴',
      keywords: ['acne vulgaris'],
    },
    {
      id: 'atopic_dermatitis',
      label: 'Atopic Dermatitis',
      icon: '🧴',
      keywords: ['atopic dermatitis'],
    },
    {
      id: 'basal_cell_carcinoma',
      label: 'Basal Cell Carcinoma',
      icon: '🧴',
      keywords: ['basal cell carcinoma'],
    },
    {
      id: 'bullous_pemphigoid',
      label: 'Bullous Pemphigoid',
      icon: '🧴',
      keywords: ['bullous pemphigoid'],
    },
    {
      id: 'carbuncles',
      label: 'Carbuncles',
      icon: '🧴',
      keywords: ['carbuncles'],
    },
    {
      id: 'dermatitis_herpetiformis',
      label: 'Dermatitis Herpetiformis',
      icon: '🧴',
      keywords: ['dermatitis herpetiformis'],
    },
    {
      id: 'dermatitis_medicamentosa',
      label: 'Dermatitis Medicamentosa (Drug Reactions)',
      icon: '🧴',
      keywords: ['dermatitis medicamentosa', 'dermatitis medicamentosa (drug reactions)', 'drug reactions'],
    },
    {
      id: 'fibroadenomas',
      label: 'Fibroadenomas',
      icon: '🧴',
      keywords: ['fibroadenomas'],
    },
    {
      id: 'fibrocystic_breast_changes',
      label: 'Fibrocystic Breast Changes',
      icon: '🧴',
      keywords: ['fibrocystic breast changes'],
    },
    {
      id: 'folliculitis',
      label: 'Folliculitis',
      icon: '🧴',
      keywords: ['folliculitis'],
    },
    {
      id: 'fungal_infections',
      label: 'Fungal (Mycotic) Infections',
      icon: '🧴',
      keywords: ['fungal  infections', 'fungal (mycotic) infections', 'mycotic'],
    },
    {
      id: 'furuncles',
      label: 'Furuncles',
      icon: '🧴',
      keywords: ['furuncles'],
    },
    {
      id: 'herpes_gestationis',
      label: 'Herpes Gestationis',
      icon: '🧴',
      keywords: ['herpes gestationis'],
    },
    {
      id: 'herpes_simplex',
      label: 'Herpes Simplex (Orolabial, Genital)',
      icon: '🧴',
      keywords: ['genital', 'herpes simplex', 'herpes simplex (orolabial, genital)', 'orolabial'],
    },
    {
      id: 'herpes_zoster',
      label: 'Herpes Zoster',
      icon: '🧴',
      keywords: ['herpes zoster'],
    },
    {
      id: 'hydradenitis_suppurativa',
      label: 'Hydradenitis Suppurativa',
      icon: '🧴',
      keywords: ['hydradenitis suppurativa'],
    },
    {
      id: 'kaposi_s_sarcoma',
      label: 'Kaposi\'s Sarcoma',
      icon: '🧴',
      keywords: ['kaposi\'s sarcoma'],
    },
    {
      id: 'latex_allergy',
      label: 'Latex Allergy',
      icon: '🧴',
      keywords: ['latex allergy'],
    },
    {
      id: 'malignant_melanoma',
      label: 'Malignant Melanoma',
      icon: '🧴',
      keywords: ['malignant melanoma'],
    },
    {
      id: 'parasitic_skin_infestation',
      label: 'Parasitic Skin Infestation',
      icon: '🧴',
      keywords: ['parasitic skin infestation'],
    },
    {
      id: 'squamous_cell_carcinoma',
      label: 'Squamous Cell Carcinoma',
      icon: '🧴',
      keywords: ['squamous cell carcinoma'],
    },
    {
      id: 'stevens_johnson_syndrome',
      label: 'Stevens-Johnson Syndrome',
      icon: '🧴',
      keywords: ['stevens-johnson syndrome'],
    },
    {
      id: 'toxic_epidermal_necrolysis',
      label: 'Toxic Epidermal Necrolysis',
      icon: '🧴',
      keywords: ['toxic epidermal necrolysis'],
    },
    {
      id: 'urticaria_2',
      label: 'Urticaria',
      icon: '🧴',
      keywords: ['urticaria'],
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
      {
      id: 'acute_lymphocytic_leukemia',
      label: 'Acute Lymphocytic Leukemia',
      icon: '🩸',
      keywords: ['acute lymphocytic leukemia'],
    },
    {
      id: 'acute_myeloid_leukemia',
      label: 'Acute Myeloid Leukemia',
      icon: '🩸',
      keywords: ['acute myeloid leukemia'],
    },
    {
      id: 'agnogenic_myeloid_metaplasia',
      label: 'Agnogenic Myeloid Metaplasia (AMM)',
      icon: '🩸',
      keywords: ['agnogenic myeloid metaplasia', 'agnogenic myeloid metaplasia (amm)', 'amm'],
    },
    {
      id: 'anemia_2',
      label: 'Anemia (Hypoproliferative, Hemolytic)',
      icon: '🩸',
      keywords: ['anemia', 'anemia (hypoproliferative, hemolytic)', 'hemolytic', 'hypoproliferative'],
    },
    {
      id: 'chronic_lymphocytic_leukemia',
      label: 'Chronic Lymphocytic Leukemia',
      icon: '🩸',
      keywords: ['chronic lymphocytic leukemia'],
    },
    {
      id: 'chronic_myeloid_leukemia',
      label: 'Chronic Myeloid Leukemia',
      icon: '🩸',
      keywords: ['chronic myeloid leukemia'],
    },
    {
      id: 'disseminated_intravascular_coagulation_2',
      label: 'Disseminated Intravascular Coagulation (DIC)',
      icon: '🩸',
      keywords: ['dic', 'disseminated intravascular coagulation', 'disseminated intravascular coagulation (dic)'],
    },
    {
      id: 'glucose_6_phosphate_dehydrogenase_deficiency',
      label: 'Glucose-6-Phosphate Dehydrogenase Deficiency',
      icon: '🩸',
      keywords: ['glucose-6-phosphate dehydrogenase deficiency'],
    },
    {
      id: 'hereditary_hemochromatosis',
      label: 'Hereditary Hemochromatosis',
      icon: '🩸',
      keywords: ['hereditary hemochromatosis'],
    },
    {
      id: 'hereditary_spherocytosis',
      label: 'Hereditary Spherocytosis',
      icon: '🩸',
      keywords: ['hereditary spherocytosis'],
    },
    {
      id: 'hodgkin_s_disease',
      label: 'Hodgkin\'s Disease',
      icon: '🩸',
      keywords: ['hodgkin\'s disease'],
    },
    {
      id: 'idiopathic_thrombocytopenic_purpura_2',
      label: 'Idiopathic Thrombocytopenic Purpura (ITP)',
      icon: '🩸',
      keywords: ['idiopathic thrombocytopenic purpura', 'idiopathic thrombocytopenic purpura (itp)', 'itp'],
    },
    {
      id: 'immune_hemolytic_anemia',
      label: 'Immune Hemolytic Anemia',
      icon: '🩸',
      keywords: ['immune hemolytic anemia'],
    },
    {
      id: 'leukocytosis',
      label: 'Leukocytosis',
      icon: '🩸',
      keywords: ['leukocytosis'],
    },
    {
      id: 'leukopenia',
      label: 'Leukopenia',
      icon: '🩸',
      keywords: ['leukopenia'],
    },
    {
      id: 'neutropenia_2',
      label: 'Neutropenia',
      icon: '🩸',
      keywords: ['neutropenia'],
    },
    {
      id: 'non_hodgkin_s_lymphomas',
      label: 'Non-Hodgkin\'s Lymphomas',
      icon: '🩸',
      keywords: ['non-hodgkin\'s lymphomas'],
    },
    {
      id: 'platelet_defects',
      label: 'Platelet Defects',
      icon: '🩸',
      keywords: ['platelet defects'],
    },
    {
      id: 'polycythemia_vera',
      label: 'Polycythemia Vera',
      icon: '🩸',
      keywords: ['polycythemia vera'],
    },
    {
      id: 'primary_thrombocythemia',
      label: 'Primary Thrombocythemia',
      icon: '🩸',
      keywords: ['primary thrombocythemia'],
    },
    {
      id: 'secondary_polycythemia',
      label: 'Secondary Polycythemia',
      icon: '🩸',
      keywords: ['secondary polycythemia'],
    },
    {
      id: 'secondary_thrombocytosis',
      label: 'Secondary Thrombocytosis',
      icon: '🩸',
      keywords: ['secondary thrombocytosis'],
    },
    {
      id: 'sickle_cell_anemia',
      label: 'Sickle Cell Anemia',
      icon: '🩸',
      keywords: ['sickle cell anemia'],
    },
    {
      id: 'thalassemia',
      label: 'Thalassemia',
      icon: '🩸',
      keywords: ['thalassemia'],
    },
    {
      id: 'thrombotic_disorders',
      label: 'Thrombotic Disorders',
      icon: '🩸',
      keywords: ['thrombotic disorders'],
    },
    {
      id: 'vitamin_k_deficiency',
      label: 'Vitamin K Deficiency',
      icon: '🩸',
      keywords: ['vitamin k deficiency'],
    },
    {
      id: 'von_willebrand_s_disease',
      label: 'Von Willebrand\'s Disease',
      icon: '🩸',
      keywords: ['von willebrand\'s disease'],
    },
    {
      id: 'dic',
      label: 'DIC (Disseminated Intravascular Coagulation)',
      icon: '🩸',
      keywords: ['dic', 'dic (disseminated intravascular coagulation)', 'disseminated intravascular coagulation'],
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
      {
      id: 'abnormal_uterine_bleeding',
      label: 'Abnormal Uterine Bleeding',
      icon: '🚻',
      keywords: ['abnormal uterine bleeding'],
    },
    {
      id: 'amenorrhea',
      label: 'Amenorrhea',
      icon: '🚻',
      keywords: ['amenorrhea'],
    },
    {
      id: 'bacterial_vaginosis',
      label: 'Bacterial Vaginosis',
      icon: '🚻',
      keywords: ['bacterial vaginosis'],
    },
    {
      id: 'cancer_of_the_fallopian_tubes',
      label: 'Cancer of the Fallopian Tubes',
      icon: '🚻',
      keywords: ['cancer of the fallopian tubes'],
    },
    {
      id: 'cancer_of_the_uterus',
      label: 'Cancer of the Uterus (Endometrium)',
      icon: '🚻',
      keywords: ['cancer of the uterus', 'cancer of the uterus (endometrium)', 'endometrium'],
    },
    {
      id: 'candidiasis',
      label: 'Candidiasis',
      icon: '🚻',
      keywords: ['candidiasis'],
    },
    {
      id: 'chlamydia',
      label: 'Chlamydia',
      icon: '🚻',
      keywords: ['chlamydia'],
    },
    {
      id: 'cystocele',
      label: 'Cystocele',
      icon: '🚻',
      keywords: ['cystocele'],
    },
    {
      id: 'dysmenorrhea',
      label: 'Dysmenorrhea',
      icon: '🚻',
      keywords: ['dysmenorrhea'],
    },
    {
      id: 'dyspareunia',
      label: 'Dyspareunia',
      icon: '🚻',
      keywords: ['dyspareunia'],
    },
    {
      id: 'ectopic_pregnancy',
      label: 'Ectopic Pregnancy',
      icon: '🚻',
      keywords: ['ectopic pregnancy'],
    },
    {
      id: 'endocervicitis',
      label: 'Endocervicitis',
      icon: '🚻',
      keywords: ['endocervicitis'],
    },
    {
      id: 'enterocele',
      label: 'Enterocele',
      icon: '🚻',
      keywords: ['enterocele'],
    },
    {
      id: 'fibrocystic_breast_changes_2',
      label: 'Fibrocystic Breast Changes',
      icon: '🚻',
      keywords: ['fibrocystic breast changes'],
    },
    {
      id: 'fibroadenomas_2',
      label: 'Fibroadenomas',
      icon: '🚻',
      keywords: ['fibroadenomas'],
    },
    {
      id: 'fistulas_of_the_vagina',
      label: 'Fistulas of the Vagina',
      icon: '🚻',
      keywords: ['fistulas of the vagina'],
    },
    {
      id: 'gonorrhea',
      label: 'Gonorrhea',
      icon: '🚻',
      keywords: ['gonorrhea'],
    },
    {
      id: 'herpes_genitalis',
      label: 'Herpes Genitalis (HSV-2)',
      icon: '🚻',
      keywords: ['herpes genitalis', 'herpes genitalis (hsv-2)', 'hsv-2'],
    },
    {
      id: 'human_papillomavirus',
      label: 'Human Papillomavirus (HPV)',
      icon: '🚻',
      keywords: ['hpv', 'human papillomavirus', 'human papillomavirus (hpv)'],
    },
    {
      id: 'menopause_2',
      label: 'Menopause',
      icon: '🚻',
      keywords: ['menopause'],
    },
    {
      id: 'menstruation_disorders',
      label: 'Menstruation Disorders',
      icon: '🚻',
      keywords: ['menstruation disorders'],
    },
    {
      id: 'pelvic_inflammatory_disease',
      label: 'Pelvic Inflammatory Disease (PID)',
      icon: '🚻',
      keywords: ['pelvic inflammatory disease', 'pelvic inflammatory disease (pid)', 'pid'],
    },
    {
      id: 'pelvic_organ_prolapse',
      label: 'Pelvic Organ Prolapse',
      icon: '🚻',
      keywords: ['pelvic organ prolapse'],
    },
    {
      id: 'perimenopause',
      label: 'Perimenopause',
      icon: '🚻',
      keywords: ['perimenopause'],
    },
    {
      id: 'pregnancy_related_neoplasm',
      label: 'Pregnancy-Related Neoplasm',
      icon: '🚻',
      keywords: ['pregnancy-related neoplasm'],
    },
    {
      id: 'premenstrual_syndrome',
      label: 'Premenstrual Syndrome',
      icon: '🚻',
      keywords: ['premenstrual syndrome'],
    },
    {
      id: 'rectocele',
      label: 'Rectocele',
      icon: '🚻',
      keywords: ['rectocele'],
    },
    {
      id: 'seminal_plasma_protein_allergy',
      label: 'Seminal Plasma Protein Allergy',
      icon: '🚻',
      keywords: ['seminal plasma protein allergy'],
    },
    {
      id: 'toxic_shock_syndrome',
      label: 'Toxic Shock Syndrome',
      icon: '🚻',
      keywords: ['toxic shock syndrome'],
    },
    {
      id: 'trichomoniasis',
      label: 'Trichomoniasis',
      icon: '🚻',
      keywords: ['trichomoniasis'],
    },
    {
      id: 'uterine_prolapse',
      label: 'Uterine Prolapse',
      icon: '🚻',
      keywords: ['uterine prolapse'],
    },
    {
      id: 'vulvovaginal_infections',
      label: 'Vulvovaginal Infections',
      icon: '🚻',
      keywords: ['vulvovaginal infections'],
    },
    {
      id: 'benign_prostatic_hyperplasia',
      label: 'Benign Prostatic Hyperplasia',
      icon: '🚻',
      keywords: ['benign prostatic hyperplasia'],
    },
    {
      id: 'cancer_of_the_penis',
      label: 'Cancer of the Penis',
      icon: '🚻',
      keywords: ['cancer of the penis'],
    },
    {
      id: 'cryptorchidism',
      label: 'Cryptorchidism (Undescended Testis)',
      icon: '🚻',
      keywords: ['cryptorchidism', 'cryptorchidism (undescended testis)', 'undescended testis'],
    },
    {
      id: 'ejaculation_problems',
      label: 'Ejaculation Problems',
      icon: '🚻',
      keywords: ['ejaculation problems'],
    },
    {
      id: 'epispadias',
      label: 'Epispadias',
      icon: '🚻',
      keywords: ['epispadias'],
    },
    {
      id: 'hydrocele',
      label: 'Hydrocele',
      icon: '🚻',
      keywords: ['hydrocele'],
    },
    {
      id: 'hypospadias',
      label: 'Hypospadias',
      icon: '🚻',
      keywords: ['hypospadias'],
    },
    {
      id: 'orchitis',
      label: 'Orchitis',
      icon: '🚻',
      keywords: ['orchitis'],
    },
    {
      id: 'peyronie_s_disease',
      label: 'Peyronie\'s Disease',
      icon: '🚻',
      keywords: ['peyronie\'s disease'],
    },
    {
      id: 'phimosis',
      label: 'Phimosis',
      icon: '🚻',
      keywords: ['phimosis'],
    },
    {
      id: 'priapism',
      label: 'Priapism',
      icon: '🚻',
      keywords: ['priapism'],
    },
    {
      id: 'testicular_cancer',
      label: 'Testicular Cancer',
      icon: '🚻',
      keywords: ['testicular cancer'],
    },
    {
      id: 'urethral_stricture',
      label: 'Urethral Stricture',
      icon: '🚻',
      keywords: ['urethral stricture'],
    },
    {
      id: 'varicocele',
      label: 'Varicocele',
      icon: '🚻',
      keywords: ['varicocele'],
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
      {
      id: 'cataracts',
      label: 'Cataracts',
      icon: '👁️',
      keywords: ['cataracts'],
    },
    {
      id: 'conjunctivitis',
      label: 'Conjunctivitis',
      icon: '👁️',
      keywords: ['conjunctivitis'],
    },
    {
      id: 'corneal_dystrophies',
      label: 'Corneal Dystrophies',
      icon: '👁️',
      keywords: ['corneal dystrophies'],
    },
    {
      id: 'corneal_disorders',
      label: 'Corneal Disorders',
      icon: '👁️',
      keywords: ['corneal disorders'],
    },
    {
      id: 'cytomegalovirus_retinitis',
      label: 'Cytomegalovirus Retinitis',
      icon: '👁️',
      keywords: ['cytomegalovirus retinitis'],
    },
    {
      id: 'diabetic_retinopathy',
      label: 'Diabetic Retinopathy',
      icon: '👁️',
      keywords: ['diabetic retinopathy'],
    },
    {
      id: 'dry_eye_syndrome',
      label: 'Dry Eye Syndrome',
      icon: '👁️',
      keywords: ['dry eye syndrome'],
    },
    {
      id: 'hypertension_related_eye_changes',
      label: 'Hypertension-Related Eye Changes',
      icon: '👁️',
      keywords: ['hypertension-related eye changes'],
    },
    {
      id: 'keratoconus',
      label: 'Keratoconus',
      icon: '👁️',
      keywords: ['keratoconus'],
    },
    {
      id: 'low_vision_blindness',
      label: 'Low Vision/Blindness',
      icon: '👁️',
      keywords: ['low vision/blindness'],
    },
    {
      id: 'macular_degeneration',
      label: 'Macular Degeneration',
      icon: '👁️',
      keywords: ['macular degeneration'],
    },
    {
      id: 'orbital_cellulitis',
      label: 'Orbital Cellulitis',
      icon: '👁️',
      keywords: ['orbital cellulitis'],
    },
    {
      id: 'refractive_errors',
      label: 'Refractive Errors',
      icon: '👁️',
      keywords: ['refractive errors'],
    },
    {
      id: 'retinal_detachment',
      label: 'Retinal Detachment',
      icon: '👁️',
      keywords: ['retinal detachment'],
    },
    {
      id: 'retinal_vascular_disorders',
      label: 'Retinal Vascular Disorders',
      icon: '👁️',
      keywords: ['retinal vascular disorders'],
    },
    {
      id: 'uveitis',
      label: 'Uveitis',
      icon: '👁️',
      keywords: ['uveitis'],
    },
    {
      id: 'acute_otitis_media',
      label: 'Acute Otitis Media',
      icon: '👂',
      keywords: ['acute otitis media'],
    },
    {
      id: 'cerumen_impaction',
      label: 'Cerumen Impaction',
      icon: '👂',
      keywords: ['cerumen impaction'],
    },
    {
      id: 'chronic_otitis_media',
      label: 'Chronic Otitis Media',
      icon: '👂',
      keywords: ['chronic otitis media'],
    },
    {
      id: 'external_otitis',
      label: 'External Otitis (Otitis Externa)',
      icon: '👂',
      keywords: ['external otitis', 'external otitis (otitis externa)', 'otitis externa'],
    },
    {
      id: 'foreign_bodies_2',
      label: 'Foreign Bodies (Ear)',
      icon: '👂',
      keywords: ['ear', 'foreign bodies', 'foreign bodies (ear)'],
    },
    {
      id: 'malignant_external_otitis',
      label: 'Malignant External Otitis',
      icon: '👂',
      keywords: ['malignant external otitis'],
    },
    {
      id: 'masses_of_external_ear',
      label: 'Masses of External Ear',
      icon: '👂',
      keywords: ['masses of external ear'],
    },
    {
      id: 'm_ni_re_s_disease_2',
      label: 'Ménière\'s Disease',
      icon: '👂',
      keywords: ['ménière\'s disease'],
    },
    {
      id: 'motion_sickness_2',
      label: 'Motion Sickness',
      icon: '👂',
      keywords: ['motion sickness'],
    },
    {
      id: 'otosclerosis',
      label: 'Otosclerosis',
      icon: '👂',
      keywords: ['otosclerosis'],
    },
    {
      id: 'serous_otitis_media',
      label: 'Serous Otitis Media',
      icon: '👂',
      keywords: ['serous otitis media'],
    },
    {
      id: 'tympanic_membrane_perforation',
      label: 'Tympanic Membrane Perforation',
      icon: '👂',
      keywords: ['tympanic membrane perforation'],
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
      {
      id: 'chronic_illness',
      label: 'Chronic Illness',
      icon: '💊',
      keywords: ['chronic illness'],
    },
    {
      id: 'end_of_life_conditions',
      label: 'End-of-Life Conditions',
      icon: '💊',
      keywords: ['end-of-life conditions'],
    },
    {
      id: 'pain',
      label: 'Pain (Acute, Chronic, Cancer-Related)',
      icon: '💊',
      keywords: ['acute', 'cancer-related', 'chronic', 'pain', 'pain (acute, chronic, cancer-related)'],
    },
],

  emergency: [
    {
      id: 'anaphylactic_reaction',
      label: 'Anaphylactic Reaction',
      icon: '🚨',
      keywords: ['anaphylactic reaction'],
    },
    {
      id: 'carbon_monoxide_poisoning',
      label: 'Carbon Monoxide Poisoning',
      icon: '🚨',
      keywords: ['carbon monoxide poisoning'],
    },
    {
      id: 'chemical_burns',
      label: 'Chemical Burns',
      icon: '🚨',
      keywords: ['chemical burns'],
    },
    {
      id: 'crush_injuries',
      label: 'Crush Injuries',
      icon: '🚨',
      keywords: ['crush injuries'],
    },
    {
      id: 'decompression_sickness',
      label: 'Decompression Sickness',
      icon: '🚨',
      keywords: ['decompression sickness'],
    },
    {
      id: 'delirium_tremens_2',
      label: 'Delirium Tremens',
      icon: '🚨',
      keywords: ['delirium tremens'],
    },
    {
      id: 'family_violence_abuse_neglect',
      label: 'Family Violence/Abuse/Neglect',
      icon: '🚨',
      keywords: ['family violence/abuse/neglect'],
    },
    {
      id: 'food_poisoning',
      label: 'Food Poisoning',
      icon: '🚨',
      keywords: ['food poisoning'],
    },
    {
      id: 'frostbite',
      label: 'Frostbite',
      icon: '🚨',
      keywords: ['frostbite'],
    },
    {
      id: 'heat_stroke',
      label: 'Heat Stroke',
      icon: '🚨',
      keywords: ['heat stroke'],
    },
    {
      id: 'hypothermia',
      label: 'Hypothermia',
      icon: '🚨',
      keywords: ['hypothermia'],
    },
    {
      id: 'ingested_poisons',
      label: 'Ingested Poisons',
      icon: '🚨',
      keywords: ['ingested poisons'],
    },
    {
      id: 'inhaled_poisons',
      label: 'Inhaled Poisons',
      icon: '🚨',
      keywords: ['inhaled poisons'],
    },
    {
      id: 'intra_abdominal_injuries',
      label: 'Intra-abdominal Injuries',
      icon: '🚨',
      keywords: ['intra-abdominal injuries'],
    },
    {
      id: 'multiple_injuries',
      label: 'Multiple Injuries',
      icon: '🚨',
      keywords: ['multiple injuries'],
    },
    {
      id: 'near_drowning',
      label: 'Near-Drowning',
      icon: '🚨',
      keywords: ['near-drowning'],
    },
    {
      id: 'sexual_assault',
      label: 'Sexual Assault',
      icon: '🚨',
      keywords: ['sexual assault'],
    },
    {
      id: 'skin_contamination_poisoning',
      label: 'Skin Contamination Poisoning',
      icon: '🚨',
      keywords: ['skin contamination poisoning'],
    },
    {
      id: 'snake_bites',
      label: 'Snake Bites',
      icon: '🚨',
      keywords: ['snake bites'],
    },
    {
      id: 'stinging_insects',
      label: 'Stinging Insects',
      icon: '🚨',
      keywords: ['stinging insects'],
    },
    {
      id: 'multiple_organ_dysfunction_syndrome',
      label: 'Multiple Organ Dysfunction Syndrome (MODS)',
      icon: '🚨',
      keywords: ['mods', 'multiple organ dysfunction syndrome', 'multiple organ dysfunction syndrome (mods)'],
    },
    {
      id: 'shock_2',
      label: 'Shock (Hypovolemic, Cardiogenic, Septic, Neurogenic, Anaphylactic)',
      icon: '🚨',
      keywords: ['anaphylactic', 'cardiogenic', 'hypovolemic', 'neurogenic', 'septic', 'shock', 'shock (hypovolemic, cardiogenic, septic, neurogenic, anaphylactic)'],
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
