import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, Upload, Database, Trash2, Edit, Search, AlertTriangle } from 'lucide-react';

export default function AdminPage() {
  const [drugs, setDrugs] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDrugs();
  }, []);

  async function loadDrugs() {
    try {
      const q = query(collection(db, 'drugs'), orderBy('last_updated', 'desc'), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrugs(data);

      const pending = data.filter(d => d.status === 'Pending Review').length;
      const active = data.filter(d => d.status === 'Active').length;
      setStats({ total: data.length, pending, active });
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  }

  async function deleteDrug(id) {
    if (!window.confirm('Are you sure you want to delete this drug?')) return;
    try {
      await deleteDoc(doc(db, 'drugs', id));
      setDrugs(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('Error deleting drug: ' + err.message);
    }
  }

  const filteredDrugs = drugs.filter(d => 
    !searchQuery || 
    d.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.drug_class?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Shield className="w-6 h-6 text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-drug-muted text-sm">Manage your drug database</p>
          </div>
        </div>
        <Link to="/admin/upload" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Bulk Upload
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-drug-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-drug-muted">Total Drugs</p>
              <p className="text-3xl font-bold text-drug-text">{stats.total}</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <Database className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-drug-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-drug-muted">Active</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-drug-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-drug-muted">Pending Review</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drugs..."
              className="w-full pl-10 pr-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
      </div>

      {/* Drugs Table */}
      <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-drug-border">
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Drug Name</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Rx Status</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Updated</th>
                <th className="text-right px-4 py-3 font-semibold text-drug-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-drug-muted">Loading...</td></tr>
              ) : filteredDrugs.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-drug-muted">No drugs found</td></tr>
              ) : (
                filteredDrugs.map(drug => (
                  <tr key={drug.id} className="border-b border-drug-border hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/drug/${drug.id}`} className="font-semibold text-primary-700 hover:underline">
                        {drug.generic_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-drug-muted">{drug.drug_class}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drug.status === 'Active' ? 'bg-green-100 text-green-700' :
                        drug.status === 'Pending Review' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {drug.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drug.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' :
                        drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {drug.prescription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-drug-muted">{drug.last_updated || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/drug/${drug.id}`} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => deleteDrug(drug.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
