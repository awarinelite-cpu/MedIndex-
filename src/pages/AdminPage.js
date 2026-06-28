import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, getDocs, query, orderBy, limit,
  deleteDoc, doc, writeBatch, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Shield, Upload, Database, Trash2, Edit,
  Search, AlertTriangle, CheckSquare, Square,
  X, Save, ChevronDown, ChevronUp
} from 'lucide-react';

const EDITABLE_FIELDS = [
  { key: 'generic_name',           label: 'Generic Name',           type: 'text',     required: true  },
  { key: 'drug_class',             label: 'Drug Class',             type: 'text',     required: true  },
  { key: 'drug_subclass',          label: 'Drug Subclass',          type: 'text',     required: false },
  { key: 'prescription_status',    label: 'Prescription Status',    type: 'select',   required: true,
    options: ['OTC', 'Prescription', 'Controlled'] },
  { key: 'primary_indications',    label: 'Primary Indications',    type: 'text',     required: true  },
  { key: 'overview',               label: 'Overview',               type: 'textarea', required: false },
  { key: 'dosage',                 label: 'Dosage',                 type: 'textarea', required: false },
  { key: 'mechanism',              label: 'Mechanism of Action',    type: 'textarea', required: false },
  { key: 'side_effects',           label: 'Side Effects',           type: 'textarea', required: false },
  { key: 'contraindications',      label: 'Contraindications',      type: 'textarea', required: false },
  { key: 'nursing_considerations', label: 'Nursing Considerations', type: 'textarea', required: false },
  { key: 'source',                 label: 'Source',                 type: 'text',     required: false },
];

export default function AdminPage() {
  const [drugs,           setDrugs]           = useState([]);
  const [stats,           setStats]           = useState({ total: 0, pending: 0, active: 0 });
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [editingDrug,     setEditingDrug]     = useState(null);   // drug object being edited
  const [editForm,        setEditForm]        = useState({});
  const [saving,          setSaving]          = useState(false);
  const [toast,           setToast]           = useState(null);   // { msg, type }
  const [confirmDelete,   setConfirmDelete]   = useState(null);   // 'single' | 'bulk'
  const [deleteTarget,    setDeleteTarget]    = useState(null);   // single drug id

  useEffect(() => { loadDrugs(); }, []);

  async function loadDrugs() {
    try {
      const q = query(collection(db, 'drugs'), orderBy('last_updated', 'desc'), limit(500));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrugs(data);
      setStats({
        total:   data.length,
        pending: data.filter(d => d.status === 'Pending Review').length,
        active:  data.filter(d => d.status === 'Active').length,
      });
    } catch (err) {
      showToast('Failed to load drugs: ' + err.message, 'error');
    }
    setLoading(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  const filteredDrugs = drugs.filter(d =>
    !searchQuery ||
    d.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.drug_class?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected = filteredDrugs.length > 0 && filteredDrugs.every(d => selectedIds.has(d.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrugs.map(d => d.id)));
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Single delete ─────────────────────────────────────────────────────────
  function promptDelete(id) {
    setDeleteTarget(id);
    setConfirmDelete('single');
  }

  async function confirmSingleDelete() {
    try {
      await deleteDoc(doc(db, 'drugs', deleteTarget));
      setDrugs(prev => prev.filter(d => d.id !== deleteTarget));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });
      showToast('Drug deleted.');
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
    setConfirmDelete(null);
    setDeleteTarget(null);
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────
  function promptBulkDelete() {
    setConfirmDelete('bulk');
  }

  async function confirmBulkDelete() {
    const ids = [...selectedIds];
    try {
      const BATCH = 500;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = writeBatch(db);
        ids.slice(i, i + BATCH).forEach(id => batch.delete(doc(db, 'drugs', id)));
        await batch.commit();
      }
      setDrugs(prev => prev.filter(d => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      showToast(`${ids.length} drug${ids.length > 1 ? 's' : ''} deleted.`);
    } catch (err) {
      showToast('Bulk delete failed: ' + err.message, 'error');
    }
    setConfirmDelete(null);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(drug) {
    setEditingDrug(drug);
    const form = {};
    EDITABLE_FIELDS.forEach(f => { form[f.key] = drug[f.key] || ''; });
    setEditForm(form);
  }

  async function saveEdit() {
    if (!editForm.generic_name?.trim()) {
      showToast('Generic name is required.', 'error'); return;
    }
    setSaving(true);
    try {
      const updates = { ...editForm, last_updated: serverTimestamp() };
      await updateDoc(doc(db, 'drugs', editingDrug.id), updates);
      setDrugs(prev => prev.map(d =>
        d.id === editingDrug.id ? { ...d, ...editForm } : d
      ));
      showToast('Drug updated successfully.');
      setEditingDrug(null);
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    }
    setSaving(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          color: toast.type === 'error' ? '#991B1B' : '#166534',
          padding: '12px 18px', borderRadius: 10, fontWeight: 600,
          fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 340,
        }}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : '✅'}
          {toast.msg}
        </div>
      )}

      {/* ── Confirm Delete Modal ────────────────────────────────────────────── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ width: 48, height: 48, background: '#FEF2F2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {confirmDelete === 'bulk'
                ? `Delete ${selectedIds.size} drug${selectedIds.size > 1 ? 's' : ''}?`
                : 'Delete this drug?'}
            </h3>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
              This action cannot be undone. The drug{confirmDelete === 'bulk' && selectedIds.size > 1 ? 's' : ''} will be permanently removed from the database.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmDelete === 'bulk' ? confirmBulkDelete : confirmSingleDelete}
                style={{ flex: 1, padding: '11px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => { setConfirmDelete(null); setDeleteTarget(null); }}
                style={{ flex: 1, padding: '11px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {editingDrug && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Edit: {editingDrug.generic_name}</h3>
              <button onClick={() => setEditingDrug(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {EDITABLE_FIELDS.map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>
                    {field.label}{field.required && <span style={{ color: '#DC2626' }}> *</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={editForm[field.key] || ''}
                      onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff' }}
                    >
                      <option value="">Select...</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={editForm[field.key] || ''}
                      onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={editForm[field.key] || ''}
                      onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ flex: 1, padding: '12px', background: saving ? '#94A3B8' : 'linear-gradient(135deg,#0070F3,#0050CC)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingDrug(null)}
                style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Drugs', value: stats.total,   color: 'text-drug-text',  bg: 'bg-primary-50',  icon: Database,      iconColor: 'text-primary-600' },
          { label: 'Active',      value: stats.active,  color: 'text-green-600',  bg: 'bg-green-50',    icon: Shield,        iconColor: 'text-green-600'   },
          { label: 'Pending',     value: stats.pending, color: 'text-amber-600',  bg: 'bg-amber-50',    icon: AlertTriangle, iconColor: 'text-amber-600'   },
        ].map(s => (
          <div key={s.label} className="bg-white border border-drug-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-drug-muted">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              <div className={`p-3 ${s.bg} rounded-lg`}>
                <s.icon className={`w-6 h-6 ${s.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Bulk Actions ───────────────────────────────────────────── */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedIds(new Set()); }}
              placeholder="Search by drug name or class..."
              className="w-full pl-10 pr-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={promptBulkDelete}
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* ── Drugs Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-drug-border">
                {/* Select all checkbox */}
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center">
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-primary-600" />
                      : <Square className="w-4 h-4 text-gray-400" />
                    }
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Drug Name</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Rx Status</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Status</th>
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
                  <tr
                    key={drug.id}
                    className={`border-b border-drug-border hover:bg-gray-50 transition-colors ${selectedIds.has(drug.id) ? 'bg-blue-50' : ''}`}
                  >
                    {/* Row checkbox */}
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(drug.id)} className="flex items-center justify-center">
                        {selectedIds.has(drug.id)
                          ? <CheckSquare className="w-4 h-4 text-primary-600" />
                          : <Square className="w-4 h-4 text-gray-300" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/drug/${drug.id}`} className="font-semibold text-primary-700 hover:underline">
                        {drug.generic_name}
                      </Link>
                      {drug.drug_subclass && (
                        <div className="text-xs text-drug-muted">{drug.drug_subclass}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-drug-muted">{drug.drug_class}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                        drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                                     'bg-blue-100 text-blue-700'
                      }`}>
                        {drug.prescription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drug.status === 'Active'         ? 'bg-green-100 text-green-700' :
                        drug.status === 'Pending Review' ? 'bg-amber-100 text-amber-700' :
                                                           'bg-gray-100 text-gray-600'
                      }`}>
                        {drug.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(drug)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => promptDelete(drug.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
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

        {/* Table footer */}
        {filteredDrugs.length > 0 && (
          <div className="px-4 py-3 border-t border-drug-border bg-gray-50 flex items-center justify-between text-sm text-drug-muted">
            <span>
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${filteredDrugs.length} selected`
                : `${filteredDrugs.length} drug${filteredDrugs.length !== 1 ? 's' : ''}`}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-primary-600 font-medium hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
