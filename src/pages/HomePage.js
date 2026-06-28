import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pill, Heart, Activity, Brain, Bone, Stethoscope, ChevronRight, TrendingUp, Shield, Grid3X3 } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredDrugs, setFeaturedDrugs] = useState([]);
  const [stats, setStats] = useState({ total: 0, classes: 0, conditions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const drugsRef = collection(db, 'drugs');
        const q = query(drugsRef, limit(6));
        const snapshot = await getDocs(q);
        const drugs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeaturedDrugs(drugs);

        // Get stats
        const allDrugs = await getDocs(collection(db, 'drugs'));
        const allConditions = await getDocs(collection(db, 'conditions'));

        const classes = new Set();
        allDrugs.docs.forEach(d => classes.add(d.data().drug_class));

        setStats({
          total: allDrugs.size,
          classes: classes.size,
          conditions: allConditions.size
        });
      } catch (err) {
        console.error('Error loading data:', err);
        // Fallback demo data
        setFeaturedDrugs([
          { id: '1', generic_name: 'Metformin', drug_class: 'Biguanide', prescription_status: 'Prescription', primary_indications: 'Type 2 Diabetes' },
          { id: '2', generic_name: 'Lisinopril', drug_class: 'ACE Inhibitor', prescription_status: 'Prescription', primary_indications: 'Hypertension' },
          { id: '3', generic_name: 'Ibuprofen', drug_class: 'NSAID', prescription_status: 'OTC', primary_indications: 'Pain, Fever' },
          { id: '4', generic_name: 'Atorvastatin', drug_class: 'Statin', prescription_status: 'Prescription', primary_indications: 'High Cholesterol' },
          { id: '5', generic_name: 'Omeprazole', drug_class: 'Proton Pump Inhibitor', prescription_status: 'OTC', primary_indications: 'GERD' },
          { id: '6', generic_name: 'Albuterol', drug_class: 'Beta-2 Agonist', prescription_status: 'Prescription', primary_indications: 'Asthma' },
        ]);
        setStats({ total: 6, classes: 6, conditions: 12 });
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const categories = [
    { name: 'Cardiovascular', icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
    { name: 'Endocrine', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Neurological', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50' },
    { name: 'Musculoskeletal', icon: Bone, color: 'text-amber-500', bg: 'bg-amber-50' },
    { name: 'Respiratory', icon: Stethoscope, color: 'text-teal-500', bg: 'bg-teal-50' },
    { name: 'All Categories', icon: Grid3X3, color: 'text-primary-600', bg: 'bg-primary-50' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Search <span className="text-primary-300">50,000+</span> Medications
          </h1>
          <p className="text-lg sm:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Comprehensive drug database covering all therapeutic classes, dosages, interactions, and safety information.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, condition, class, or NDC..."
              className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-300/50 shadow-2xl text-lg"
            />
            {searchQuery && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
                Search
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-10 text-primary-100">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              <div className="text-sm opacity-80">Drugs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.classes}</div>
              <div className="text-sm opacity-80">Drug Classes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.conditions}</div>
              <div className="text-sm opacity-80">Conditions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={cat.name === 'All Categories' ? '/browse' : `/browse/${cat.name.toLowerCase()}`}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-drug-border hover:border-primary-300 hover:shadow-md transition-all bg-white"
            >
              <div className={`p-3 rounded-lg ${cat.bg}`}>
                <cat.icon className={`w-6 h-6 ${cat.color}`} />
              </div>
              <span className="text-sm font-semibold text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Drugs */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured Medications</h2>
            <Link to="/browse" className="flex items-center gap-1 text-primary-600 font-semibold hover:text-primary-700">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-48" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredDrugs.map((drug) => (
                <Link
                  key={drug.id}
                  to={`/drug/${drug.id}`}
                  className="group bg-white border border-drug-border rounded-xl p-5 hover:border-primary-300 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Pill className="w-5 h-5 text-primary-600" />
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      drug.prescription_status === 'OTC' 
                        ? 'bg-green-100 text-green-700' 
                        : drug.prescription_status === 'Controlled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {drug.prescription_status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-drug-text group-hover:text-primary-700 transition-colors">
                    {drug.generic_name}
                  </h3>
                  <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
                  <p className="text-sm text-drug-muted mt-2 line-clamp-2">
                    {drug.primary_indications}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/admin/upload" className="flex items-center gap-4 p-6 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200 hover:shadow-md transition-all">
            <div className="p-3 bg-primary-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-primary-900">Bulk Upload</h3>
              <p className="text-sm text-primary-700">Import medications via CSV</p>
            </div>
          </Link>
          <Link to="/admin" className="flex items-center gap-4 p-6 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200 hover:shadow-md transition-all">
            <div className="p-3 bg-amber-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900">Admin Portal</h3>
              <p className="text-sm text-amber-700">Manage drug database</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
