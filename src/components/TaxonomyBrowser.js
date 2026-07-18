import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pill } from 'lucide-react';
import { DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomy } from '../utils/classifyDrugTaxonomy';
import { getDisplayDrugClass } from '../utils/drugCategory';

const STATUS_BADGE = {
  OTC: 'bg-green-100 text-green-700',
  Controlled: 'bg-red-100 text-red-700',
};
function statusBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-blue-100 text-blue-700';
}

function DrugRow({ drug }) {
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
      {drug.prescription_status && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${statusBadgeClass(drug.prescription_status)}`}>
          {drug.prescription_status}
        </span>
      )}
    </Link>
  );
}

function SubclassSection({ subclass, drugs }) {
  const [open, setOpen] = useState(drugs.length > 0);
  useEffect(() => { if (drugs.length > 0) setOpen(true); }, [drugs.length]);

  return (
    <div className="border-t border-drug-border first:border-t-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="text-sm font-medium">{subclass.name}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-drug-muted">{drugs.length} drug{drugs.length === 1 ? '' : 's'}</span>
          {open ? <ChevronDown className="w-4 h-4 text-drug-muted" /> : <ChevronRight className="w-4 h-4 text-drug-muted" />}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2">
          {drugs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-drug-muted italic">No drugs added yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {drugs.map(d => <DrugRow key={d.id} drug={d} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassCard({ classDef, subclassGroups, total, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);

  return (
    <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          {classDef.number != null && (
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
              {classDef.number}
            </span>
          )}
          <h3 className="font-bold truncate">{classDef.name}</h3>
        </div>
        <span className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-drug-muted">{total} drug{total === 1 ? '' : 's'}</span>
          {open ? <ChevronDown className="w-5 h-5 text-drug-muted" /> : <ChevronRight className="w-5 h-5 text-drug-muted" />}
        </span>
      </button>
      {open && (
        <div>
          {subclassGroups.map(({ subclass, drugs }) => (
            <SubclassSection key={subclass.id} subclass={subclass} drugs={drugs} />
          ))}
        </div>
      )}
    </div>
  );
}

// Groups `drugs` into the 21-chapter taxonomy (+ an Unclassified bucket),
// preserving every subclass — including ones with zero matched drugs — so
// the full formulary structure is always visible, not just the parts that
// happen to have entries already.
export default function TaxonomyBrowser({ drugs, activeQuery }) {
  const grouped = useMemo(() => {
    const bySubclass = new Map(); // `${classId}::${subclassId}` -> drugs[]
    for (const drug of drugs) {
      const { classId, subclassId } = classifyDrugTaxonomy(drug);
      const key = `${classId}::${subclassId}`;
      if (!bySubclass.has(key)) bySubclass.set(key, []);
      bySubclass.get(key).push(drug);
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

  const hasActiveFilter = Boolean(activeQuery && activeQuery.trim());

  return (
    <div className="space-y-4">
      {visibleGroups.map(({ classDef, subclassGroups, total }) => (
        <ClassCard
          key={classDef.id}
          classDef={classDef}
          subclassGroups={subclassGroups}
          total={total}
          defaultOpen={hasActiveFilter ? total > 0 : false}
        />
      ))}
    </div>
  );
}
