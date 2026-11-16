// src/pages/DrugClassPage.js
//
// One page per top-level drug class (/class/:classId). Lists every drug in
// the class grouped by subclass. Each subclass, and the class as a whole,
// has a collapsed "Find more drugs" dropdown (AI + Google search).
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Pill, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { findClassById } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomyAll } from '../utils/classifyDrugTaxonomy';
import { DrugRow, classVisual } from '../components/TaxonomyBrowser';
import { subclassIcon } from '../utils/subclassIcons';
import ClassMoreDrugs from '../components/ClassMoreDrugs';

export default function DrugClassPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const [query, setQuery] = useState('');
  // Single-open accordion: opening one subclass closes the one that was open.
  const [openSubId, setOpenSubId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
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

  const { icon: ClassIcon } = classVisual(classDef.id);
  const q = query.trim().toLowerCase();
  const matches = d => (!statusFilter || (d.prescription_status || 'Prescription') === statusFilter) && (!q
    || (d.generic_name || '').toLowerCase().includes(q)
    || (d.drug_class || '').toLowerCase().includes(q)
    || (d.drug_subclass || '').toLowerCase().includes(q));
  const filtering = !!(q || statusFilter);

  return (
    <div className="cp-page max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/browse'))}
        className="cp-back"
      >
        <ArrowLeft className="w-6 h-6" /> Back
      </button>

      <div className="cp-hero">
        <ClassIcon className="cp-hero-icon" strokeWidth={1.4} />
        <span className="cp-hero-divider" />
        <div className="min-w-0">
          <h1 className="cp-hero-title">{classDef.name}</h1>
          <p className="cp-hero-sub">
            {loading ? 'Loading…' : `${allClassDrugs.length} drug${allClassDrugs.length === 1 ? '' : 's'} \u2022 ${classDef.subclasses.length} subclasses`}
          </p>
        </div>
      </div>

      <div className="cp-search">
        <Search className="cp-search-icon" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search in ${classDef.name}…`}
        />
        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          aria-label="Filter drugs"
          aria-expanded={showFilters}
          className={`cp-filter-btn ${statusFilter ? 'is-active' : ''}`}
        >
          <SlidersHorizontal className="w-6 h-6" />
        </button>
      </div>

      {showFilters && (
        <div className="cp-filter-panel">
          {['', 'Prescription', 'OTC', 'Controlled'].map(st => (
            <button
              key={st || 'all'}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`cp-chip ${statusFilter === st ? 'is-on' : ''}`}
            >
              {st || 'All status'}
            </button>
          ))}
        </div>
      )}

      <div className="cp-list">
        {groups.map(({ subclass, drugs }) => {
          const shown = drugs.filter(matches);
          if (filtering && shown.length === 0) return null;
          // While searching/filtering, every section with a match stays open so results are visible.
          const isOpen = filtering ? true : openSubId === subclass.id;
          const SubIcon = subclassIcon(subclass, ClassIcon);
          const count = filtering ? shown.length : drugs.length;
          return (
            <section key={subclass.id} id={subclass.id} className={`cp-card ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                onClick={() => setOpenSubId(id => (id === subclass.id ? null : subclass.id))}
                aria-expanded={isOpen}
                className="cp-row"
              >
                <span className="cp-row-icon"><SubIcon className="w-7 h-7" /></span>
                <span className="cp-row-name">{subclass.name}</span>
                <span className="cp-row-count">{count} drug{count === 1 ? '' : 's'}</span>
                <ChevronRight className={`cp-row-chev ${isOpen ? 'is-open' : ''}`} />
              </button>
              {isOpen && (
                <div className="cp-card-body">
                  {shown.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-drug-muted italic">No drugs added yet</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
                      {shown.map(d => <DrugRow key={d.id} drug={d} />)}
                    </div>
                  )}
                  {!filtering && (
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

      {filtering && groups.every(g => g.drugs.filter(matches).length === 0) && (
        <div className="text-center py-16">
          <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-drug-muted">No drug in this class matches your search.</p>
        </div>
      )}

      {!filtering && (
        <section className="cp-card cp-more">
          <h2 className="cp-more-title">More in {classDef.name}</h2>
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
