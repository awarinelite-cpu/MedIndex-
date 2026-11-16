import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Pill, Brain, Bone, Syringe, Soup, Heart,
  Droplet, Wind, ShieldAlert, ShieldCheck, Activity, Baby, Dna, Eye,
  Ear, Layers, SprayCan, ShieldPlus, Smile, AlertTriangle, Thermometer,
  Sparkles,
} from 'lucide-react';
import { DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomyAll } from '../utils/classifyDrugTaxonomy';
import { getDisplayDrugClass } from '../utils/drugCategory';
import AddToFavoritesHeart from './AddToFavoritesHeart';

// Icon + tint for each of the 21 formulary chapters — purely visual, keyed
// off the taxonomy's own class id, so it doesn't touch the taxonomy data
// itself (names/numbers stay exactly as filed).
const CLASS_VISUALS = {
  'cns':                         { icon: Brain,         color: 'text-purple-500',  bg: 'bg-purple-100'  },
  'musculoskeletal':             { icon: Bone,           color: 'text-orange-500',  bg: 'bg-orange-100'  },
  'anaesthesia':                 { icon: Syringe,        color: 'text-sky-500',     bg: 'bg-sky-100'     },
  'gastrointestinal':            { icon: Soup,           color: 'text-green-600',   bg: 'bg-green-100'   },
  'cardiovascular':              { icon: Heart,          color: 'text-pink-500',    bg: 'bg-pink-100'    },
  'blood-nutrition':             { icon: Droplet,        color: 'text-red-500',     bg: 'bg-red-100'     },
  'respiratory':                 { icon: Wind,           color: 'text-blue-500',    bg: 'bg-blue-100'    },
  'antiallergics':                { icon: ShieldAlert,    color: 'text-amber-500',   bg: 'bg-amber-100'   },
  'anti-infective':              { icon: ShieldCheck,    color: 'text-teal-600',    bg: 'bg-teal-100'    },
  'endocrine':                   { icon: Activity,       color: 'text-indigo-500',  bg: 'bg-indigo-100'  },
  'reproductive-urinary':        { icon: Baby,           color: 'text-pink-500',    bg: 'bg-pink-100'    },
  'oncology-immunosuppressive':  { icon: Dna,            color: 'text-violet-500',  bg: 'bg-violet-100'  },
  'ophthalmological':            { icon: Eye,            color: 'text-cyan-500',    bg: 'bg-cyan-100'    },
  'ent':                         { icon: Ear,            color: 'text-lime-600',    bg: 'bg-lime-100'    },
  'dermatological':              { icon: Layers,         color: 'text-fuchsia-500', bg: 'bg-fuchsia-100' },
  'disinfectants':               { icon: SprayCan,       color: 'text-slate-500',   bg: 'bg-slate-100'   },
  'immunological':               { icon: ShieldPlus,     color: 'text-emerald-500', bg: 'bg-emerald-100' },
  'dental':                      { icon: Smile,          color: 'text-yellow-600',  bg: 'bg-yellow-100'  },
  'antidotes-poisoning':         { icon: AlertTriangle,  color: 'text-red-600',     bg: 'bg-red-100'     },
  'diagnostic-equipment':        { icon: Thermometer,    color: 'text-gray-500',    bg: 'bg-gray-100'    },
  'natural-health':              { icon: Sparkles,       color: 'text-orange-500',  bg: 'bg-orange-100'  },
};
const DEFAULT_CLASS_VISUAL = { icon: Pill, color: 'text-primary-600', bg: 'bg-primary-100' };
export function classVisual(classId) {
  return CLASS_VISUALS[classId] || DEFAULT_CLASS_VISUAL;
}

const STATUS_BADGE = {
  OTC: 'bg-green-100 text-green-700',
  Controlled: 'bg-red-100 text-red-700',
};
function statusBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-blue-100 text-blue-700';
}

export function DrugRow({ drug }) {
  return (
    <Link
      to={`/drug/${drug.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="p-1.5 bg-primary-50 rounded-md flex-shrink-0">
        <Pill className="w-3.5 h-3.5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary-700">{drug.generic_name}</p>
        <p className="text-xs text-drug-muted truncate">{getDisplayDrugClass(drug)}</p>
      </div>
      <AddToFavoritesHeart drug={drug} />
      {drug.prescription_status && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${statusBadgeClass(drug.prescription_status)}`}>
          {drug.prescription_status}
        </span>
      )}
    </Link>
  );
}

// Each class is now a link to its own page (/class/:classId), which lists
// every drug in the class grouped by subclass. No accordion on this screen.
function ClassCard({ classDef, total }) {
  const { icon: ClassIcon, color, bg } = classVisual(classDef.id);
  return (
    <div className="tx-card">
      <Link to={`/class/${classDef.id}`} className="tx-row">
        <span className={`tx-icon ${bg}`}>
          <ClassIcon className={`w-6 h-6 ${color}`} />
        </span>
        <h3 className="tx-name">{classDef.name}</h3>
        <span className="tx-count">{total} drug{total === 1 ? '' : 's'}</span>
        <span className="tx-go">
          <ChevronRight className="w-5 h-5" />
        </span>
      </Link>
    </div>
  );
}

// Groups `drugs` into the 21-chapter taxonomy (+ an Unclassified bucket),
// preserving every subclass — including ones with zero matched drugs — so
// the full formulary structure is always visible, not just the parts that
// happen to have entries already.
//
// A drug is placed under every class/subclass its indications support, not
// just its single "home" pharmacological class — see
// classifyDrugTaxonomyAll — so a drug indicated for conditions spanning
// more than one chapter shows up in each one it's actually indicated for.
//
// `allDrugs` — when provided — is the full, unfiltered database (independent
// of any active search/status/class filter) used only for the AI insight
// panels' "already in database" dedup, so that check isn't limited by
// whatever's currently visible, or by which class/subclass the local
// taxonomy happened to file a drug under. Falls back to `drugs` when not
// supplied.
export default function TaxonomyBrowser({ drugs }) {
  const grouped = useMemo(() => {
    const bySubclass = new Map(); // `${classId}::${subclassId}` -> drugs[]
    for (const drug of drugs) {
      for (const { classId, subclassId } of classifyDrugTaxonomyAll(drug)) {
        const key = `${classId}::${subclassId}`;
        if (!bySubclass.has(key)) bySubclass.set(key, []);
        bySubclass.get(key).push(drug);
      }
    }
    const allClasses = [...DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET];
    return allClasses.map(classDef => {
      const total = classDef.subclasses.reduce(
        (sum, sub) => sum + (bySubclass.get(`${classDef.id}::${sub.id}`) || []).length, 0);
      return { classDef, total };
    });
  }, [drugs]);

  // Hide the Unclassified bucket when empty; it is a fallback, not one of the 21 chapters.
  const visibleGroups = grouped.filter(g => g.classDef.id !== UNCLASSIFIED_BUCKET.id || g.total > 0);

  return (
    <div className="tx-list">
      {visibleGroups.map(({ classDef, total }) => (
        <ClassCard key={classDef.id} classDef={classDef} total={total} />
      ))}
    </div>
  );
}
