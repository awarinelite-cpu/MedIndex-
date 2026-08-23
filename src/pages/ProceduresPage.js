import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { useProcedures } from '../hooks/useProcedures';
import AiProcedureSearchFallback from '../components/AiProcedureSearchFallback';
import AiProcedureCategorySearchFallback from '../components/AiProcedureCategorySearchFallback';

export default function ProceduresPage() {
  const { procedures: ALL_PROCEDURES, loading } = useProcedures();

  const ALL_CATEGORIES = useMemo(
    () => [...new Set(ALL_PROCEDURES.map(p => p.category).filter(Boolean))].sort(),
    [ALL_PROCEDURES]
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [filterCategory, setFilterCategory] = useState(initialCategory);

  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('q', searchQuery);
    if (filterCategory) next.set('category', filterCategory);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterCategory]);

  const filteredProcedures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fc = filterCategory.trim().toLowerCase();
    // Visible to everyone as soon as it's saved — review is no longer a
    // gate on visibility, just a separate admin cleanup queue.
    return ALL_PROCEDURES
      .filter(p => {
        const matchesCategory = !fc || (p.category || '').toLowerCase() === fc;
        const matchesQuery = !q || (p.name || '').toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [ALL_PROCEDURES, searchQuery, filterCategory]);

  // Exact-name match check — same logic as drugs' BrowsePage — decides
  // whether the AI fallback offer shows below the results.
  const hasExactMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return ALL_PROCEDURES.some(p => (p.name || '').toLowerCase() === q);
  }, [ALL_PROCEDURES, searchQuery]);

  // Names already in the selected category (independent of the text search
  // box), so the category AI insight doesn't re-suggest something we have.
  const namesInSelectedCategory = useMemo(() => {
    if (!filterCategory) return [];
    const fc = filterCategory.trim().toLowerCase();
    return ALL_PROCEDURES.filter(p => (p.category || '').toLowerCase() === fc).map(p => p.name).filter(Boolean);
  }, [ALL_PROCEDURES, filterCategory]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-drug-text flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary-600" /> Medical Procedures
        </h1>
        <p className="text-drug-muted mt-1">
          {loading ? 'Loading…' : `${filteredProcedures.length} of ${ALL_PROCEDURES.length} procedures`}
        </p>
      </div>

      <div className="bg-white border border-drug-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search procedures by name…"
            className="flex-1 px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {filterCategory && (
        <AiProcedureCategorySearchFallback category={filterCategory} existingNames={namesInSelectedCategory} />
      )}

      {filteredProcedures.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-drug-muted text-lg">
            {searchQuery.trim() ? `No procedure matches "${searchQuery}".` : 'No procedures yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-drug-border rounded-xl divide-y divide-drug-border overflow-hidden">
          {filteredProcedures.map(p => (
            <Link
              key={p.id}
              to={`/procedure/${p.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm text-drug-text truncate">{p.name}</div>
                {p.category && <div className="text-xs text-drug-muted mt-0.5">{p.category}</div>}
              </div>
              <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {searchQuery.trim() && !hasExactMatch && (
        <AiProcedureSearchFallback searchQuery={searchQuery} />
      )}
    </div>
  );
}
