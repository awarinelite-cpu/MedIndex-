// src/pages/DrugClassPage.js
//
// One page per top-level drug class (/class/:classId). Lists every drug in
// the class grouped by subclass. Each subclass, and the class as a whole,
// has a collapsed "Find more drugs" dropdown (AI + Google search).
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Pill, ChevronDown, ChevronRight } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { findClassById } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomyAll } from '../utils/classifyDrugTaxonomy';
import { DrugRow, classVisual } from '../components/TaxonomyBrowser';
import ClassMoreDrugs from '../components/ClassMoreDrugs';

export default function DrugClassPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const [query, setQuery] = useState('');
  // Single-open accordion: opening one subclass closes the one that was open.
  const [openSubId, setOpenSubId] = useState(null);
  const classDef = findClassById(classId);

  const groups = useMemo(() => {
    if (!classDef) return [];
    const bySub = new Map();
    for (const drug of ALL_DRUGS) {
      for (const hit of classifyDrugTaxonomyAll(drug)) {
        if (hit.classId !== classDef.id) continue;
        if (!bySub.has(hit.subclassId)) bySub.set(hit.subclassId, []);
        bySub.get(hit.subclassId).push(drug);
      }
    }
    return classDef.subclasses.map(subclass => ({
      subclass,
      drugs: (bySub.get(subclass.id) || [])
        .sort((a, b) => (a.generic_name || '').localeCompare(b.generic_name || '')),
    }));
  }, [ALL_DRUGS, classDef]);

  const allClassDrugs = useMemo(() => {
    const seen = new Map();
    groups.forEach(g => g.drugs.forEach(d => seen.set(d.id, d)));
    return [...seen.values()];
  }, [groups]);

  if (!classDef) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-drug-muted mb-4">That drug class was not found.</p>
        <button onClick={() => navigate('/browse')} className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold">
          Back to drug classes
        </button>
      </div>
    );
  }

  const { icon: ClassIcon, color, bg } = classVisual(classDef.id);
  const q = query.trim().toLowerCase();
  const matches = d => !q
    || (d.generic_name || '').toLowerCase().includes(q)
    || (d.drug_class || '').toLowerCase().includes(q)
    || (d.drug_subclass || '').toLowerCase().includes(q);

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/browse'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-4 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-4">
        <span className={`flex-shrink-0 grid place-items-center w-14 h-14 rounded-full ${bg}`}>
          <ClassIcon className={`w-7 h-7 ${color}`} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{classDef.name}</h1>
          <p className="text-sm text-drug-muted mt-0.5">
            {loading ? 'Loading…' : `${allClassDrugs.length} drug${allClassDrugs.length === 1 ? '' : 's'} · ${classDef.subclasses.length} subclasses`}
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-600" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search in ${classDef.name}…`}
          className="w-full pl-11 pr-4 py-3 rounded-full border border-drug-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Jump chips */}
      {!q && groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
          {groups.map(({ subclass, drugs }) => (
            <a
              key={subclass.id}
              href={`#${subclass.id}`}
              onClick={e => {
                e.preventDefault();
                setOpenSubId(subclass.id);
                setTimeout(() => document.getElementById(subclass.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-primary-200 bg-primary-50 text-primary-700 whitespace-nowrap"
            >
              {subclass.name} ({drugs.length})
            </a>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {groups.map(({ subclass, drugs }) => {
          const shown = drugs.filter(matches);
          if (q && shown.length === 0) return null;
          // While searching, every section with a match stays open so results are visible.
          const isOpen = q ? true : openSubId === subclass.id;
          return (
            <section key={subclass.id} id={subclass.id} className="scroll-mt-24 bg-white border border-drug-border rounded-3xl overflow-hidden">
              <button
                type="button"
                onClick={() => !q && setOpenSubId(id => (id === subclass.id ? null : subclass.id))}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <h2 className="text-base sm:text-lg font-bold min-w-0">{subclass.name}</h2>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-drug-muted whitespace-nowrap">
                    {drugs.length} drug{drugs.length === 1 ? '' : 's'}
                  </span>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-primary-600" /> : <ChevronRight className="w-5 h-5 text-primary-600" />}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 sm:px-4 pb-4 border-t border-drug-border pt-2">
                  {shown.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-drug-muted italic">No drugs added yet</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
                      {shown.map(d => <DrugRow key={d.id} drug={d} />)}
                    </div>
                  )}
                  {!q && (
                    <ClassMoreDrugs
                      className={subclass.name}
                      parentClassName={classDef.name}
                      existingDrugs={drugs}
                      databaseDrugs={ALL_DRUGS}
                      classId={classDef.id}
                      subclassId={subclass.id}
                    />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {q && groups.every(g => g.drugs.filter(matches).length === 0) && (
        <div className="text-center py-16">
          <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-drug-muted">No drug in this class matches "{query}".</p>
        </div>
      )}

      {!q && (
        <section className="mt-6 bg-white border border-drug-border rounded-3xl p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-bold px-2">More in {classDef.name}</h2>
          <ClassMoreDrugs
            className={classDef.name}
            existingDrugs={allClassDrugs}
            databaseDrugs={ALL_DRUGS}
            classId={classDef.id}
            subclasses={classDef.subclasses}
          />
        </section>
      )}
    </div>
  );
}
