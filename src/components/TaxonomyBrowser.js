import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Pill, Brain, Bone, Syringe, Soup, Heart,
  Droplet, Wind, ShieldAlert, ShieldCheck, Activity, Baby, Dna, Eye,
  Ear, Layers, SprayCan, ShieldPlus, Smile, AlertTriangle, Thermometer,
  Sparkles,
} from 'lucide-react';
import { DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomyAll } from '../utils/classifyDrugTaxonomy';
import { getDisplayDrugClass } from '../utils/drugCategory';
import AiClassInsight from './AiClassInsight';
import AddToFavoritesHeart from './AddToFavoritesHeart';

// Icon + tint for each of the 21 formulary chapters — purely visual, keyed
// off the taxonomy's own class id, so it doesn't touch the taxonomy data
// itself (names/numbers stay exactly as filed).
const CLASS_VISUALS = {
  'cns':                         { icon: Brain,         color: 'text-purple-500',  bg: 'bg-purple-100'  },
  'musculoskeletal':             { icon: Bone,           color: 'text-stone-500',   bg: 'bg-stone-100'   },
  'anaesthesia':                 { icon: Syringe,        color: 'text-sky-500',     bg: 'bg-sky-100'     },
  'gastrointestinal':            { icon: Soup,           color: 'text-green-600',   bg: 'bg-green-100'   },
  'cardiovascular':              { icon: Heart,          color: 'text-red-500',     bg: 'bg-red-100'     },
  'blood-nutrition':             { icon: Droplet,        color: 'text-rose-500',    bg: 'bg-rose-100'    },
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
function classVisual(classId) {
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

// Controlled — its open/closed state is owned by the parent ClassCard, which
// only ever keeps one subclass open at a time within that class. Every
// subclass starts closed; nothing auto-opens itself just because it has
// drugs in it (the AI-insight panel each one carries would otherwise all
// mount at once, which is both noisy and wasteful).
function SubclassSection({ subclass, drugs, isOpen, onToggle, parentClassName, databaseDrugs, classId }) {
  return (
    <div className="border-t border-drug-border first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="text-sm font-medium">{subclass.name}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-drug-muted">{drugs.length} drug{drugs.length === 1 ? '' : 's'}</span>
          {isOpen ? <ChevronDown className="w-4 h-4 text-drug-muted" /> : <ChevronRight className="w-4 h-4 text-drug-muted" />}
        </span>
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          {drugs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-drug-muted italic">No drugs added yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {drugs.map(d => <DrugRow key={d.id} drug={d} />)}
            </div>
          )}
          <div className="mt-2 px-1">
            <AiClassInsight
              className={subclass.name}
              existingDrugs={drugs}
              parentClassName={parentClassName}
              databaseDrugs={databaseDrugs}
              classId={classId}
              subclassId={subclass.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Controlled — its open/closed state is owned by the parent (TaxonomyBrowser),
// which keeps only one class open at a time across the whole list. Closed by
// default; opening one class closes whichever other class was open, and
// opening a class does not imply any of its subclasses are open too — those
// each start closed until tapped, one at a time, same as the class level.
function ClassCard({ classDef, subclassGroups, total, isOpen, onToggle, databaseDrugs }) {
  const [openSubclassId, setOpenSubclassId] = useState(null);

  // Every drug across this class's subclasses — used so the class-level AI
  // insight knows about everything already filed in the class, not just
  // whichever subclass happens to be expanded right now.
  const allClassDrugs = useMemo(
    () => subclassGroups.flatMap(g => g.drugs),
    [subclassGroups]
  );

  return (
    <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          {(() => {
            const { icon: ClassIcon, color, bg } = classVisual(classDef.id);
            return (
              <span className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
                <ClassIcon className={`w-5 h-5 ${color}`} />
              </span>
            );
          })()}
          <h3 className="font-bold truncate">{classDef.name}</h3>
        </div>
        <span className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-drug-muted">{total} drug{total === 1 ? '' : 's'}</span>
          {isOpen ? <ChevronDown className="w-5 h-5 text-drug-muted" /> : <ChevronRight className="w-5 h-5 text-drug-muted" />}
        </span>
      </button>
      {isOpen && (
        <div>
          {subclassGroups.map(({ subclass, drugs }) => (
            <SubclassSection
              key={subclass.id}
              subclass={subclass}
              drugs={drugs}
              isOpen={openSubclassId === subclass.id}
              onToggle={() => setOpenSubclassId(id => (id === subclass.id ? null : subclass.id))}
              parentClassName={classDef.name}
              databaseDrugs={databaseDrugs}
              classId={classDef.id}
            />
          ))}
          <div className="border-t border-drug-border px-4 pb-4">
            <AiClassInsight
              className={classDef.name}
              existingDrugs={allClassDrugs}
              databaseDrugs={databaseDrugs}
              classId={classDef.id}
              subclasses={classDef.subclasses}
            />
          </div>
        </div>
      )}
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
export default function TaxonomyBrowser({ drugs, allDrugs }) {
  const databaseDrugs = allDrugs || drugs;
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
      const subclassGroups = classDef.subclasses.map(subclass => ({
        subclass,
        drugs: (bySubclass.get(`${classDef.id}::${subclass.id}`) || [])
          .sort((a, b) => (a.generic_name || '').localeCompare(b.generic_name || '')),
      }));
      const total = subclassGroups.reduce((sum, g) => sum + g.drugs.length, 0);
      return { classDef, subclassGroups, total };
    });
  }, [drugs]);

  // Hide the Unclassified bucket entirely when it's empty — it's a
  // fallback, not one of the 21 official chapters, so it shouldn't clutter
  // the list unless something actually landed there.
  const visibleGroups = grouped.filter(g => g.classDef.id !== UNCLASSIFIED_BUCKET.id || g.total > 0);

  // Single-open accordion at the class level: opening one class closes
  // whichever other class was open. Every class starts closed — including
  // when a search/filter is active — until the person taps it open.
  const [openClassId, setOpenClassId] = useState(null);

  return (
    <div className="space-y-4">
      {visibleGroups.map(({ classDef, subclassGroups, total }) => (
        <ClassCard
          key={classDef.id}
          classDef={classDef}
          subclassGroups={subclassGroups}
          total={total}
          isOpen={openClassId === classDef.id}
          onToggle={() => setOpenClassId(id => (id === classDef.id ? null : classDef.id))}
          databaseDrugs={databaseDrugs}
        />
      ))}
    </div>
  );
}
