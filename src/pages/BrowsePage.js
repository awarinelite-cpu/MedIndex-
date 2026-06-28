import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Pill, ChevronRight, Grid3X3, List } from 'lucide-react';

export default function BrowsePage() {
  const { condition } = useParams();
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        let drugsQuery = collection(db, 'drugs');

        if (condition) {
          drugsQuery = query(drugsQuery, where('primary_indications', '>=', condition));
        }

        const drugsSnap = await getDocs(drugsQuery);
        const drugsData = drugsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDrugs(drugsData);
      } catch (err) {
        console.error('Error:', err);
        // Fallback
        setDrugs([
          { id: '1', generic_name: 'Metformin', drug_class: 'Biguanide', prescription_status: 'Prescription', primary_indications: 'Type 2 Diabetes' },
          { id: '2', generic_name: 'Lisinopril', drug_class: 'ACE Inhibitor', prescription_status: 'Prescription', primary_indications: 'Hypertension' },
          { id: '3', generic_name: 'Ibuprofen', drug_class: 'NSAID', prescription_status: 'OTC', primary_indications: 'Pain, Fever' },
          { id: '4', generic_name: 'Atorvastatin', drug_class: 'Statin', prescription_status: 'Prescription', primary_indications: 'High Cholesterol' },
          { id: '5', generic_name: 'Omeprazole', drug_class: 'Proton Pump Inhibitor', prescription_status: 'OTC', primary_indications: 'GERD' },
          { id: '6', generic_name: 'Albuterol', drug_class: 'Beta-2 Agonist', prescription_status: 'Prescription', primary_indications: 'Asthma' },
        ]);
      }
      setLoading(false);
    }
    loadData();
  }, [condition]);

  const drugClasses = [...new Set(drugs.map(d => d.drug_class))].sort();

  const filteredDrugs = drugs.filter(drug => {
    const matchesSearch = !searchQuery || 
      drug.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drug.drug_class?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drug.primary_indications?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = !filterClass || drug.drug_class === filterClass;
    const matchesStatus = !filterStatus || drug.prescription_status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Browse Medications</h1>
          <p className="text-drug-muted mt-1">{filteredDrugs.length} drugs found</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-drug-border rounded-lg p-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drugs..."
            className="flex-1 px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select 
            value={filterClass} 
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Classes</option>
            {drugClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Status</option>
            <option value="OTC">OTC</option>
            <option value="Prescription">Prescription</option>
            <option value="Controlled">Controlled</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-48" />)}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrugs.map(drug => (
            <Link key={drug.id} to={`/drug/${drug.id}`} className="group bg-white border border-drug-border rounded-xl p-5 hover:border-primary-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Pill className="w-5 h-5 text-primary-600" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  drug.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' : 
                  drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  {drug.prescription_status}
                </span>
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary-700 transition-colors">{drug.generic_name}</h3>
              <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
              <p className="text-sm text-drug-muted mt-2">{drug.primary_indications}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {filteredDrugs.map((drug, i) => (
            <Link key={drug.id} to={`/drug/${drug.id}`} className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${i !== filteredDrugs.length - 1 ? 'border-b border-drug-border' : ''}`}>
              <div className="p-2 bg-primary-50 rounded-lg">
                <Pill className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{drug.generic_name}</h3>
                <p className="text-sm text-primary-600">{drug.drug_class}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                drug.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' : 
                drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' : 
                'bg-blue-100 text-blue-700'
              }`}>
                {drug.prescription_status}
              </span>
              <ChevronRight className="w-4 h-4 text-drug-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
