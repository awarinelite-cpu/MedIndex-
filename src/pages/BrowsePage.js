import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pill, ChevronRight, Grid3X3, List } from 'lucide-react';
import drugsData from '../data/seedDrugs.json';

const ALL_DRUGS   = drugsData;
const ALL_CLASSES = [...new Set(ALL_DRUGS.map(d => d.drug_class).filter(Boolean))].sort();

export default function BrowsePage() {
  const { condition }             = useParams();
  const [searchParams]            = useSearchParams();
  const initialQ                  = searchParams.get('q') || condition || '';

  const [searchQuery,  setSearchQuery]  = useState(initialQ);
  const [filterClass,  setFilterClass]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode,     setViewMode]     = useState('grid');

  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_DRUGS.filter(drug => {
      const matchesSearch = !q ||
        drug.generic_name?.toLowerCase().includes(q) ||
        drug.drug_class?.toLowerCase().includes(q) ||
        drug.primary_indications?.toLowerCase().includes(q) ||
        drug.overview?.toLowerCase().includes(q);
      const matchesClass  = !filterClass  || drug.drug_class === filterClass;
      const matchesStatus = !filterStatus || drug.prescription_status === filterStatus;
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [searchQuery, filterClass, filterStatus]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Browse Medications</h1>
          <p className="text-drug-muted mt-1">{filteredDrugs.length} of {ALL_DRUGS.length} drugs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-drug-border rounded-lg p-1">
            <button onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search drugs by name, class, or indication..."
            className="flex-1 px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Classes</option>
            {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Status</option>
            <option value="OTC">OTC</option>
            <option value="Prescription">Prescription</option>
            <option value="Controlled">Controlled</option>
          </select>
        </div>
      </div>

      {/* Results — always instant */}
      {filteredDrugs.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-drug-muted text-lg">No drugs match your search.</p>
          <button onClick={() => { setSearchQuery(''); setFilterClass(''); setFilterStatus(''); }}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
            Clear filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrugs.map(drug => (
            <Link key={drug.id} to={`/drug/${drug.id}`}
                  className="group bg-white border border-drug-border rounded-xl p-5 hover:border-primary-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Pill className="w-5 h-5 text-primary-600" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                  drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                               'bg-blue-100 text-blue-700'
                }`}>
                  {drug.prescription_status}
                </span>
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary-700 transition-colors">{drug.generic_name}</h3>
              <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
              <p className="text-sm text-drug-muted mt-2 line-clamp-2">{drug.primary_indications}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {filteredDrugs.map((drug, i) => (
            <Link key={drug.id} to={`/drug/${drug.id}`}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                    i !== filteredDrugs.length - 1 ? 'border-b border-drug-border' : ''
                  }`}>
              <div className="p-2 bg-primary-50 rounded-lg">
                <Pill className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{drug.generic_name}</h3>
                <p className="text-sm text-primary-600 truncate">{drug.drug_class}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                             'bg-blue-100 text-blue-700'
              }`}>
                {drug.prescription_status}
              </span>
              <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
