// src/utils/subclassIcons.js
// Icon for each drug subclass row on a class page. Explicit picks for the
// CNS subclasses (matching the design), keyword rules for the rest, and the
// parent class icon as the last fallback.
import {
  Brain, BrainCog, BrainCircuit, ShieldPlus, Drama, Zap, Network, Pill, Activity,
  Cigarette, Waves, Bone, Droplet, Droplets, HeartPulse, Baby, Eye, Ear, Wind,
  Bug, FlaskConical, Syringe, Thermometer, Dna, Layers, Flame,
  ShieldAlert, Salad, Scissors, Smile, Sparkles, Moon,
} from 'lucide-react';

const BY_ID = {
  'cns-anxiety-sleep': Brain,
  'cns-psychotic': BrainCog,
  'cns-antipsychotic-antidotes': ShieldPlus,
  'cns-mood': Drama,
  'cns-ocd-panic': Zap,
  'cns-parkinson': Network,
  'cns-anticonvulsants': Pill,
  'cns-analgesics': Pill,
  'cns-migraine': Zap,
  'cns-dementia': BrainCircuit,
  'cns-adhd': Activity,
  'cns-substance-dependence': Cigarette,
  'cns-antivertigo': Waves,
  'cns-other': Brain,
};

const RULES = [
  [/antidote|poison/i, ShieldPlus],
  [/anaesthe/i, Syringe],
  [/vaccine|immunoglobulin|sera/i, Syringe],
  [/antibacterial|antifungal|antiviral|antiprotozoal|anthelmintic|anti-?infective/i, Bug],
  [/cytotoxic|antineoplastic|immuno/i, Dna],
  [/bone|gout|rheumat|muscle/i, Bone],
  [/blood|anemi|anaemi|coagul|thromb|plasma/i, Droplet],
  [/heart|arrhythm|anginal|cardio|hypertens|hypotens|lipid|diuretic/i, HeartPulse],
  [/asthma|respirat|cough|expectorant|nasal/i, Wind],
  [/eye|glaucoma|mydriatic/i, Eye],
  [/ear\b|ear drugs/i, Ear],
  [/obstetric|neonatal|contracept|genito|genital|sex hormone/i, Baby],
  [/diabet|thyroid|pituitary|endocrine|hormone/i, Activity],
  [/skin|derma|acne|psoria|wart|wound|keratosis|hair|ultraviolet/i, Layers],
  [/antacid|ulcer|laxative|diarrhoea|antiemetic|haemorrhoid|bile|liver|spasmodic/i, Salad],
  [/vitamin|mineral|nutrition|supplement|herbal|appetite|electrolyte|dialysis/i, Droplets],
  [/dental|mouth|throat|orofacial/i, Smile],
  [/allerg|histamine|sympathomimetic/i, ShieldAlert],
  [/alcohol|aldehyde|chlor|iodine|peroxide|phenol|permanganate|dye|surfactant|disinfect/i, Flame],
  [/diagnostic|equipment/i, Thermometer],
  [/corticosteroid|enzyme/i, FlaskConical],
  [/surgic|scissor/i, Scissors],
  [/sleep/i, Moon],
  [/pending|other|misc/i, Sparkles],
];

export function subclassIcon(subclass, FallbackIcon = Pill) {
  if (BY_ID[subclass.id]) return BY_ID[subclass.id];
  const hit = RULES.find(([re]) => re.test(subclass.name || ''));
  return hit ? hit[1] : FallbackIcon;
}

