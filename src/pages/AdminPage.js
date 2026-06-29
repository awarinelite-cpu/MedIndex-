import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Upload, Database, Trash2, Edit,
  Search, AlertTriangle, CheckSquare, Square,
  X, Save, Filter, ChevronDown
} from 'lucide-react';
import initialDrugs from '../data/seedDrugs.json';

// ── Editable fields ────────────────────────────────────────────────────────
const EDITABLE_FIELDS = [
  { key: 'generic_name',         label: 'Generic Name',         type: 'text',     required: true  },
  { key: 'drug_class',           label: 'Drug Class',           type: 'text',     required: true  },
  { key: 'drug_subclass',        label: 'Drug Subclass',        type: 'text',     required: false },
  { key: 'prescription_status',  label: 'Prescription Status',  type: 'select',   required: true,
    options: ['OTC', 'Prescription', 'Controlled'] },
  { key: 'overview',             label: 'Overview',             type: 'textarea', required: false },
  { key: 'primary_indications',  label: 'Primary Indications',  type: 'textarea', required: false },
  { key: 'dosage',               label: 'Dosage',               type: 'textarea', required: false },
  { key: 'mechanism',            label: 'Mechanism of Action',  type: 'textarea', required: false },
  { key: 'side_effects',         label: 'Side Effects',         type: 'textarea', required: false },
  { key: 'contraindications',    label: 'Contraindications',    type: 'textarea', required: false },
  { key: 'nursing_considerations',label:'Nursing Considerations',type: 'textarea', required: false },
  { key: 'source',               label: 'Source',               type: 'text',     required: false },
];

// ── Pre-compute filter option lists ───────────────────────────────────────
const ALL_CLASSES    = [...new Set(initialDrugs.map(d => d.drug_class).filter(Boolean))].sort();
const ALL_SUBCLASSES = [...new Set(initialDrugs.map(d => d.drug_subclass).filter(Boolean))].sort();
const ALL_STATUSES   = ['OTC', 'Prescription', 'Controlled'];

export default function AdminPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [drugs,          setDrugs]          = useState(initialDrugs);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [filterClass,    setFilterClass]    = useState('');
  const [filterSubclass, setFilterSubclass] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterIndication, setFilterIndication] = useState('');
  const [showFilters,    setShowFilters]    = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [editingDrug,    setEditingDrug]    = useState(null);
  const [editForm,       setEditForm]       = useState({});
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null); // 'single'|'bulk'
  const [deleteTarget,   setDeleteTarget]   = useState(null);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      drugs.length,
    classes:    new Set(drugs.map(d => d.drug_class).filter(Boolean)).size,
    controlled: drugs.filter(d => d.prescription_status === 'Controlled').length,
  }), [drugs]);

  // ── Active filter count badge ─────────────────────────────────────────────
  const activeFilterCount = [filterClass, filterSubclass, filterStatus, filterIndication]
    .filter(Boolean).length;

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drugs.filter(drug => {
      const matchSearch = !q ||
        drug.generic_name?.toLowerCase().includes(q) ||
        drug.drug_class?.toLowerCase().includes(q) ||
        drug.drug_subclass?.toLowerCase().includes(q) ||
        drug.primary_indications?.toLowerCase().includes(q) ||
        drug.overview?.toLowerCase().includes(q);
      const matchClass    = !filterClass    || drug.drug_class === filterClass;
      const matchSubclass = !filterSubclass || drug.drug_subclass === filterSubclass;
      const matchStatus   = !filterStatus   || drug.prescription_status === filterStatus;
      const matchInd      = !filterIndication ||
        drug.primary_indications?.toLowerCase().includes(filterIndication.toLowerCase());
      return matchSearch && matchClass && matchSubclass && matchStatus && matchInd;
    });
  }, [drugs, searchQuery, filterClass, filterSubclass, filterStatus, filterIndication]);

  const allSelected = filteredDrugs.length > 0 &&
    filteredDrugs.every(d => selectedIds.has(d.id));

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function clearAllFilters() {
    setSearchQuery('');
    setFilterClass('');
    setFilterSubclass('');
    setFilterStatus('');
    setFilterIndication('');
    setSelectedIds(new Set());
  }

  // ── Selection ─────────────────────────────────────────────────────────────
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

  // ── Delete single ─────────────────────────────────────────────────────────
  function promptDelete(id) {
    setDeleteTarget(id);
    setConfirmDelete('single');
  }
  function confirmSingleDelete() {
    setDrugs(prev => prev.filter(d => d.id !== deleteTarget));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });
    showToast('Drug deleted.');
    setConfirmDelete(null);
    setDeleteTarget(null);
  }

  // ── Delete bulk ───────────────────────────────────────────────────────────
  function promptBulkDelete() { setConfirmDelete('bulk'); }
  function confirmBulkDelete() {
    const count = selectedIds.size;
    setDrugs(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    showToast(`${count} drug${count > 1 ? 's' : ''} deleted.`);
    setConfirmDelete(null);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(drug) {
    setEditingDrug(drug);
    const form = {};
    EDITABLE_FIELDS.forEach(f => { form[f.key] = drug[f.key] || ''; });
    setEditForm(form);
  }
  function saveEdit() {
    if (!editForm.generic_name?.trim()) {
      showToast('Generic name is required.', 'error'); return;
    }
    setSaving(true);
    // Regenerate slug id if name changed
    const newId = editForm.generic_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setDrugs(prev => prev.map(d =>
      d.id === editingDrug.id
        ? { ...d, ...editForm, id: newId }
        : d
    ));
    showToast('Drug updated.');
    setEditingDrug(null);
    setSaving(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:'fixed', top:20, right:20, zIndex:9999,
          background: toast.type==='error' ? '#FEF2F2' : '#F0FDF4',
          border:`1px solid ${toast.type==='error' ? '#FECACA':'#BBF7D0'}`,
          color: toast.type==='error' ? '#991B1B':'#166534',
          padding:'12px 18px', borderRadius:10, fontWeight:600,
          fontSize:14, boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
          display:'flex', alignItems:'center', gap:8, maxWidth:340,
        }}>
          {toast.type==='error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0"/> : '✅'}
          {toast.msg}
        </div>
      )}

      {/* ── Confirm Delete Modal ────────────────────────────────────────────── */}
      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:'28px 24px',maxWidth:420,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}}>
            <div style={{width:48,height:48,background:'#FEF2F2',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
              <Trash2 className="w-5 h-5 text-red-600"/>
            </div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8}}>
              {confirmDelete==='bulk'
                ? `Delete ${selectedIds.size} drug${selectedIds.size>1?'s':''}?`
                : 'Delete this drug?'}
            </h3>
            <p style={{color:'#64748B',fontSize:14,marginBottom:24}}>
              This will remove {confirmDelete==='bulk' && selectedIds.size>1 ? 'these drugs' : 'this drug'} from the list.
            </p>
            <div style={{display:'flex',gap:10}}>
              <button
                onClick={confirmDelete==='bulk' ? confirmBulkDelete : confirmSingleDelete}
                style={{flex:1,padding:'11px',background:'#DC2626',color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}
              >Yes, Delete</button>
              <button
                onClick={()=>{setConfirmDelete(null);setDeleteTarget(null);}}
                style={{flex:1,padding:'11px',background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingDrug && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'28px 24px',maxWidth:640,width:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:800}}>Edit: {editingDrug.generic_name}</h3>
              <button onClick={()=>setEditingDrug(null)} style={{background:'#F1F5F9',border:'none',borderRadius:8,padding:'6px 8px',cursor:'pointer'}}>
                <X className="w-4 h-4 text-gray-500"/>
              </button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {EDITABLE_FIELDS.map(field => (
                <div key={field.key}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:5}}>
                    {field.label}{field.required && <span style={{color:'#DC2626'}}> *</span>}
                  </label>
                  {field.type==='select' ? (
                    <select
                      value={editForm[field.key]||''}
                      onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',background:'#fff'}}
                    >
                      <option value="">Select...</option>
                      {field.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type==='textarea' ? (
                    <textarea
                      value={editForm[field.key]||''}
                      onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))}
                      rows={3}
                      style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box'}}
                    />
                  ) : (
                    <input
                      type="text"
                      value={editForm[field.key]||''}
                      onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',boxSizing:'border-box'}}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{flex:1,padding:'12px',background:saving?'#94A3B8':'linear-gradient(135deg,#1e40af,#1e3a8a)',color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
              >
                <Save className="w-4 h-4"/>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={()=>setEditingDrug(null)}
                style={{flex:1,padding:'12px',background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Shield className="w-6 h-6 text-primary-700"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-drug-muted text-sm">Manage the drug database</p>
          </div>
        </div>
        <Link to="/admin/upload" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4"/> Bulk Upload
        </Link>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label:'Total Drugs',     value:stats.total,      icon:Database,      bg:'bg-primary-50', iconColor:'text-primary-600', textColor:'text-drug-text' },
          { label:'Drug Classes',    value:stats.classes,    icon:Filter,        bg:'bg-blue-50',    iconColor:'text-blue-600',    textColor:'text-blue-700'  },
          { label:'Controlled',      value:stats.controlled, icon:AlertTriangle, bg:'bg-red-50',     iconColor:'text-red-600',     textColor:'text-red-700'   },
        ].map(s=>(
          <div key={s.label} className="bg-white border border-drug-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-drug-muted">{s.label}</p>
                <p className={`text-3xl font-bold ${s.textColor}`}>{s.value}</p>
              </div>
              <div className={`p-3 ${s.bg} rounded-lg`}>
                <s.icon className={`w-6 h-6 ${s.iconColor}`}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter Bar ────────────────────────────────────────────── */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-4 space-y-3">
        {/* Row 1: search + filter toggle + bulk delete */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input
              type="text"
              value={searchQuery}
              onChange={e=>{ setSearchQuery(e.target.value); setSelectedIds(new Set()); }}
              placeholder="Search name, class, subclass, indication..."
              className="w-full pl-10 pr-4 py-2.5 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
            />
          </div>

          <button
            onClick={()=>setShowFilters(v=>!v)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'9px 14px', borderRadius:8,
              border: showFilters ? '1.5px solid #1e40af' : '1.5px solid #E2E8F0',
              background: showFilters ? '#EFF6FF' : '#fff',
              color: showFilters ? '#1e40af' : '#64748B',
              fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap',
            }}
          >
            <Filter className="w-4 h-4"/>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                background:'#1e40af', color:'#fff',
                borderRadius:'50%', width:18, height:18,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:900,
              }}>{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters?'rotate-180':''}`}/>
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={promptBulkDelete}
              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:8,border:'1.5px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}
            >
              <Trash2 className="w-4 h-4"/>
              Delete {selectedIds.size} selected
            </button>
          )}
        </div>

        {/* Row 2: filter dropdowns (collapsible) */}
        {showFilters && (
          <div className="pt-3 border-t border-drug-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              {/* Drug Class */}
              <div>
                <label className="block text-xs font-700 text-drug-muted uppercase tracking-wide mb-1.5">
                  Drug Class
                </label>
                <select
                  value={filterClass}
                  onChange={e=>{ setFilterClass(e.target.value); setFilterSubclass(''); setSelectedIds(new Set()); }}
                  className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">All Classes</option>
                  {ALL_CLASSES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Drug Subclass */}
              <div>
                <label className="block text-xs font-700 text-drug-muted uppercase tracking-wide mb-1.5">
                  Drug Subclass
                </label>
                <select
                  value={filterSubclass}
                  onChange={e=>{ setFilterSubclass(e.target.value); setSelectedIds(new Set()); }}
                  className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">All Subclasses</option>
                  {/* If a class is selected, only show subclasses belonging to it */}
                  {(filterClass
                    ? ALL_SUBCLASSES.filter(sc =>
                        drugs.some(d => d.drug_class === filterClass && d.drug_subclass === sc)
                      )
                    : ALL_SUBCLASSES
                  ).map(sc=><option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>

              {/* Prescription Status */}
              <div>
                <label className="block text-xs font-700 text-drug-muted uppercase tracking-wide mb-1.5">
                  Rx Status
                </label>
                <select
                  value={filterStatus}
                  onChange={e=>{ setFilterStatus(e.target.value); setSelectedIds(new Set()); }}
                  className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Indication keyword */}
              <div>
                <label className="block text-xs font-700 text-drug-muted uppercase tracking-wide mb-1.5">
                  Indication
                </label>
                <input
                  type="text"
                  value={filterIndication}
                  onChange={e=>{ setFilterIndication(e.target.value); setSelectedIds(new Set()); }}
                  placeholder="e.g. hypertension"
                  className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            {/* Active filter tags + clear all */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {filterClass && (
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>
                    Class: {filterClass}
                    <button onClick={()=>{ setFilterClass(''); setFilterSubclass(''); }} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',lineHeight:1,padding:0}}>×</button>
                  </span>
                )}
                {filterSubclass && (
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>
                    Subclass: {filterSubclass}
                    <button onClick={()=>setFilterSubclass('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',lineHeight:1,padding:0}}>×</button>
                  </span>
                )}
                {filterStatus && (
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>
                    Status: {filterStatus}
                    <button onClick={()=>setFilterStatus('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',lineHeight:1,padding:0}}>×</button>
                  </span>
                )}
                {filterIndication && (
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>
                    Indication: {filterIndication}
                    <button onClick={()=>setFilterIndication('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',lineHeight:1,padding:0}}>×</button>
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  style={{padding:'3px 10px',background:'none',border:'1px solid #E2E8F0',borderRadius:20,fontSize:12,fontWeight:700,color:'#64748B',cursor:'pointer'}}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        <div className="text-xs text-drug-muted pt-1">
          {filteredDrugs.length === drugs.length
            ? `${drugs.length} drugs`
            : `${filteredDrugs.length} of ${drugs.length} drugs matching filters`}
        </div>
      </div>

      {/* ── Drugs Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-drug-border">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center">
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-primary-600"/>
                      : <Square className="w-4 h-4 text-gray-400"/>}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Drug Name</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted hidden sm:table-cell">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted hidden md:table-cell">Subclass</th>
                <th className="text-left px-4 py-3 font-semibold text-drug-muted">Rx Status</th>
                <th className="text-right px-4 py-3 font-semibold text-drug-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrugs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <Search className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                    <p className="text-drug-muted font-medium">No drugs match your filters</p>
                    <button onClick={clearAllFilters} className="mt-3 text-primary-600 text-sm font-semibold hover:underline">
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDrugs.map(drug => (
                  <tr
                    key={drug.id}
                    className={`border-b border-drug-border hover:bg-gray-50 transition-colors ${selectedIds.has(drug.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button onClick={()=>toggleSelect(drug.id)} className="flex items-center justify-center">
                        {selectedIds.has(drug.id)
                          ? <CheckSquare className="w-4 h-4 text-primary-600"/>
                          : <Square className="w-4 h-4 text-gray-300"/>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/drug/${drug.id}`} className="font-semibold text-primary-700 hover:underline">
                        {drug.generic_name}
                      </Link>
                      {/* Show class on mobile (hidden col) */}
                      <div className="sm:hidden text-xs text-drug-muted mt-0.5">{drug.drug_class}</div>
                    </td>
                    <td className="px-4 py-3 text-drug-muted hidden sm:table-cell">{drug.drug_class}</td>
                    <td className="px-4 py-3 text-drug-muted hidden md:table-cell text-xs">{drug.drug_subclass || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drug.prescription_status==='OTC'        ? 'bg-green-100 text-green-700' :
                        drug.prescription_status==='Controlled' ? 'bg-red-100 text-red-700' :
                                                                   'bg-blue-100 text-blue-700'
                      }`}>
                        {drug.prescription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={()=>openEdit(drug)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4"/>
                        </button>
                        <button
                          onClick={()=>promptDelete(drug.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4"/>
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
                : `${filteredDrugs.length} drug${filteredDrugs.length!==1?'s':''}`}
            </span>
            {selectedIds.size > 0 && (
              <button onClick={()=>setSelectedIds(new Set())} className="text-primary-600 font-medium hover:underline">
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
