import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill, Search, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { isEssentialDrug } from '../data/essentialMedicines';
import { quickSearch } from '../utils/searchDrugs';

export default function EssentialDrugsPage() {
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const [searchQuery, setSearchQuery] = useState('');

  const essentialDrugs = useMemo(
    () => ALL_DRUGS.filter(isEssentialDrug),
    [ALL_DRUGS]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return essentialDrugs;
    return quickSearch(essentialDrugs, searchQuery, essentialDrugs.length);
  }, [essentialDrugs, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-drug-muted hover:text-drug-text mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-green-50 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Essential Drugs</h1>
          <p className="text-drug-muted text-sm mt-0.5">
            {loading ? 'Loading…' : `${essentialDrugs.length} of ${ALL_DRUGS.length} drugs`} — matched against Nigeria's National Essential Medicines List (NEML), 8th Edition 2024, Federal Ministry of Health &amp; Social Welfare.
          </p>
        </div>
      </div>

      <div className="bg-white border border-drug-border rounded-xl p-4 my-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search essential drugs by name, class, indication…"
            className="w-full pl-10 pr-4 py-2.5 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-drug-muted text-lg">
            {essentialDrugs.length === 0
              ? "No drugs in your database currently match the NEML list. As you add more drugs, matches will appear here automatically."
              : "No essential drugs match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(drug => (
            <Link key={drug.id} to={`/drug/${drug.id}`}
                  className="group bg-white border border-drug-border rounded-xl p-5 hover:border-green-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Pill className="w-5 h-5 text-green-600" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                  drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                               'bg-blue-100 text-blue-700'
                }`}>
                  {drug.prescription_status}
                </span>
              </div>
              <h3 className="text-lg font-bold group-hover:text-green-700 transition-colors">{drug.generic_name}</h3>
              <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
              <p className="text-sm text-drug-muted mt-2 line-clamp-2">
                {drug.indications || drug.primary_indications}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
