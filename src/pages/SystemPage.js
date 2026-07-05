import React, { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap,
  Pill, ChevronRight, Grid3X3, List, ArrowLeft, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { getSystemById } from '../data/anatomicalSystems';
import { getDrugsForSystem } from '../utils/systemMatch';
import { groupDrugsByCondition } from '../data/systemConditions';

const ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Grid3X3,
};

function RxBadge({ status }) {
  const cls =
    status === 'OTC'        ? 'bg-green-100 text-green-700' :
    status === 'Controlled' ? 'bg-red-100 text-red-700'     :
                              'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${cls}`}>
      {status}
    </span>
  );
}

/* ── Collapsible condition section ──────────────────────────────────────── */
function ConditionSection({ condition, drugs, viewMode, classFilter, nameSearch, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  // Apply filters within this condition
  const filtered = useMemo(() => {
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      const q = nameSearch.trim().toLowerCase();
      const matchName = !q ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      return matchClass && matchName;
    });
  }, [drugs, classFilter, nameSearch]);

  // Sub-group by drug class within the condition — always computed
  const byClass = useMemo(() => {
    const map = new Map();
    for (const drug of filtered) {
      const key = drug.drug_class || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(drug);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (filtered.length === 0) return null;

  return (
    <div className="bg-white border border-drug-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{condition.icon}</span>
          <div className="text-left">
            <div className="font-bold text-drug-text">{condition.label}</div>
            <div className="text-xs text-drug-muted mt-0.5">
              {filtered.length} drug{filtered.length !== 1 ? 's' : ''} · {byClass.length} class{byClass.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-drug-muted flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-drug-muted flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-drug-border">
          {byClass.map(([className, classDrugs], ci) => (
            <div key={className}>
              {/* Drug class sub-header */}
              <div className={`flex items-center justify-between px-5 py-2 bg-gray-50 ${ci > 0 ? 'border-t border-drug-border' : ''}`}>
                <Link
                  to={`/browse?class=${encodeURIComponent(className)}`}
                  className="text-xs font-bold text-primary-700 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {className}
                </Link>
                <span className="text-xs text-drug-muted">{classDrugs.length}</span>
              </div>

              {/* Drugs */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {classDrugs.map(drug => (
                    <Link
                      key={drug.id}
                      to={`/drug/${drug.id}`}
                      className="group border border-drug-border rounded-xl p-4 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <Pill className="w-4 h-4 text-primary-600" />
                        </div>
                        <RxBadge status={drug.prescription_status} />
                      </div>
                      <h3 className="font-bold text-sm group-hover:text-primary-700 transition-colors">
                        {drug.generic_name}
                      </h3>
                      <p className="text-xs text-primary-600 mt-0.5">{drug.drug_subclass || drug.drug_class}</p>
                      <p className="text-xs text-drug-muted mt-1.5 line-clamp-2">
                        {drug.indications || drug.primary_indications}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div>
                  {classDrugs.map((drug, i) => (
                    <Link
                      key={drug.id}
                      to={`/drug/${drug.id}`}
                      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                        i !== classDrugs.length - 1 ? 'border-b border-drug-border' : ''
                      }`}
                    >
                      <div className="p-1.5 bg-primary-50 rounded-lg flex-shrink-0">
                        <Pill className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{drug.generic_name}</div>
                        <div className="text-xs text-primary-600 truncate">
                          {drug.drug_subclass || drug.drug_class}
                        </div>
                      </div>
                      <RxBadge status={drug.prescription_status} />
                      <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SystemPage() {
  const { systemId }  = useParams();
  const navigate      = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const [viewMode,    setViewMode]    = useState('list');
  const [classFilter, setClassFilter] = useState('');
  const [nameSearch,  setNameSearch]  = useState('');

  const system = getSystemById(systemId);

  // All drugs in this system
  const drugs = useMemo(() => {
    if (!system) return [];
    return getDrugsForSystem(ALL_DRUGS, system).sort((a, b) =>
      (a.generic_name || '').localeCompare(b.generic_name || '')
    );
  }, [ALL_DRUGS, system]);

  // Group by condition
  const conditionGroups = useMemo(
    () => groupDrugsByCondition(drugs, systemId),
    [drugs, systemId]
  );

  // All drug classes across this system (for dropdown)
  const allClasses = useMemo(() => {
    const s = new Set(drugs.map(d => d.drug_class).filter(Boolean));
    return [...s].sort();
  }, [drugs]);

  // Total visible after filters
  const visibleCount = useMemo(() => {
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      const q = nameSearch.trim().toLowerCase();
      const matchName = !q ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      return matchClass && matchName;
    }).length;
  }, [drugs, classFilter, nameSearch]);

  if (!system) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-drug-muted mb-4">Unknown system.</p>
        <Link to="/systems" className="text-primary-600 font-semibold hover:underline">
          Browse all systems
        </Link>
      </div>
    );
  }

  const Icon = ICONS[system.icon] || Pill;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* System header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 rounded-xl ${system.bg}`}>
          <Icon className={`w-7 h-7 ${system.color}`} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{system.name}</h1>
          <p className="text-drug-muted mt-0.5 text-sm">
            {loading ? 'Loading…' : `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} · ${conditionGroups.size} condition${conditionGroups.size !== 1 ? 's' : ''} · ${allClasses.length} drug class${allClasses.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            placeholder="Search within this system…"
            className="w-full pl-4 pr-4 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="py-2 px-3 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="">All Drug Classes ({allClasses.length})</option>
          {allClasses.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        <button onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <List className="w-5 h-5" />
        </button>
        <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <Grid3X3 className="w-5 h-5" />
        </button>
      </div>

      {/* Filter summary */}
      {(classFilter || nameSearch) && (
        <div className="flex items-center gap-3 mb-4 text-sm text-drug-muted">
          <span>
            Showing <strong className="text-drug-text">{visibleCount}</strong> of {drugs.length} drugs
          </span>
          <button
            onClick={() => { setClassFilter(''); setNameSearch(''); }}
            className="text-red-500 font-semibold hover:text-red-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-drug-muted">Loading…</div>
      ) : drugs.length === 0 ? (
        <div className="bg-white border border-drug-border rounded-xl p-10 text-center">
          <Icon className={`w-10 h-10 mx-auto mb-3 ${system.color}`} />
          <p className="text-drug-muted">No medications matched to {system.name} yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...conditionGroups.values()].map((entry, idx) => (
            <ConditionSection
              key={entry.condition.id}
              condition={entry.condition}
              drugs={entry.drugs}
              viewMode={viewMode}
              classFilter={classFilter}
              nameSearch={nameSearch}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        Drugs are grouped by the clinical conditions they treat within the {system.name} system.
        A drug treating multiple conditions (e.g. a beta-blocker used in both Hypertension and Heart Failure)
        appears under each relevant group.
      </div>
    </div>
  );
}
