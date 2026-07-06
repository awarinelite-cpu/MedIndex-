import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, getDocs, doc, deleteDoc, updateDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Shield, Upload, Database, Trash2, Edit,
  Search, AlertTriangle, CheckSquare, Square,
  X, Save, Filter, ChevronDown, RefreshCw,
  Sparkles, ChevronRight, Zap, PlayCircle,
} from 'lucide-react';
import seedDrugs from '../data/seedDrugs.json';
import { generateDrugOnce, saveParsedDrug, isDrugComplete, getMissingGroups, REQUIRED_FIELD_GROUPS } from '../utils/aiDrugSave';
import { useAiInsight } from '../context/AiInsightContext';
import ConditionTagBackfill from '../components/ConditionTagBackfill';

// ── Completeness check using unified field group aliases ──────────────────
// Handles both AI schema (indications/adverse_effect/nursing_action)
// and legacy CSV schema (primary_indications/side_effects/nursing_considerations)
function isIncomplete(drug) {
  return getMissingGroups(drug).length > 0;
}

// ── Editable fields ────────────────────────────────────────────────────────
const EDITABLE_FIELDS = [
  { key: 'generic_name',          label: 'Generic Name',          type: 'text',     required: true  },
  { key: 'drug_class',            label: 'Drug Class',            type: 'text',     required: true  },
  { key: 'drug_subclass',         label: 'Drug Subclass',         type: 'text',     required: false },
  { key: 'prescription_status',   label: 'Prescription Status',   type: 'select',   required: true,
    options: ['OTC', 'Prescription', 'Controlled'] },
  { key: 'overview',              label: 'Overview',              type: 'textarea', required: false },
  { key: 'strength',              label: 'Strength (formulation)', type: 'textarea', required: false },
  { key: 'indications',           label: 'Indications',           type: 'textarea', required: false },
  { key: 'adult_dose',            label: 'Adult Dose',            type: 'textarea', required: false },
  { key: 'pharmacology',          label: 'Mechanism / Pharmacology', type: 'textarea', required: false },
  { key: 'adverse_effect',        label: 'Adverse Effects',       type: 'textarea', required: false },
  { key: 'contraindications',     label: 'Contraindications',     type: 'textarea', required: false },
  { key: 'nursing_action',        label: 'Nursing Considerations', type: 'textarea', required: false },
  { key: 'source',                label: 'Source',                type: 'text',     required: false },
];

const ALL_STATUSES = ['OTC', 'Prescription', 'Controlled'];
const PARALLEL_SAVES = 8; // paid Gemini tier

async function parallelMap(items, fn, concurrency = PARALLEL_SAVES) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    results.push(...settled);
  }
  return results;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const {
    running: globalFixRunning, progress: globalFixProgress,
    startGlobalFix, stopGlobalFix, subscribeFix,
  } = useAiInsight();
  const [activeTab, setActiveTab]  = useState('drugs');

  // ── Drug list state ────────────────────────────────────────────────────
  const [drugs,            setDrugs]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [seeding,          setSeeding]          = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [filterClass,      setFilterClass]      = useState('');
  const [filterSubclass,   setFilterSubclass]   = useState('');
  const [filterStatus,     setFilterStatus]     = useState('');
  const [filterIndication, setFilterIndication] = useState('');
  const [filterIncompleteOnly, setFilterIncompleteOnly] = useState(false);
  const [fixingIds,        setFixingIds]        = useState(new Set());
  const [bulkFixRunning,   setBulkFixRunning]    = useState(false);
  const [bulkFixProgress,  setBulkFixProgress]   = useState({ done: 0, total: 0 });
  const bulkFixAbortRef = useRef(false);
  const [showFilters,      setShowFilters]      = useState(false);
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [editingDrug,      setEditingDrug]      = useState(null);
  const [editForm,         setEditForm]         = useState({});
  const [saving,           setSaving]           = useState(false);
  const [toast,            setToast]            = useState(null);
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);

  // ── AI Generate state ──────────────────────────────────────────────────
  const [aiClassList,   setAiClassList]   = useState([]);
  const [expandedClass, setExpandedClass] = useState(null);
  const [classAiState,  setClassAiState]  = useState({});
  const [runningClass,  setRunningClass]  = useState(null);
  const abortRef = useRef(false);

  // ── Load from Firestore ────────────────────────────────────────────────
  const loadDrugs = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'drugs'));
      if (snap.empty) { await seedFirestore(); return; }
      const data = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      data.sort((a, b) => (a.generic_name || '').localeCompare(b.generic_name || ''));
      setDrugs(data);
    } catch (err) { showToast('Failed to load: ' + err.message, 'error'); }
    setLoading(false);
  }, []); // eslint-disable-line

  useEffect(() => { loadDrugs(); }, [loadDrugs]);

  // Refresh the table once the background General AI Insight run finishes,
  // since it writes to Firestore independently of this page's local state.
  const prevGlobalFixRunningRef = useRef(false);
  useEffect(() => {
    if (prevGlobalFixRunningRef.current && !globalFixRunning) loadDrugs();
    prevGlobalFixRunningRef.current = globalFixRunning;
  }, [globalFixRunning, loadDrugs]);

  // Live sync: as the background General AI Insight run fixes each drug,
  // patch it straight into local state so the Incomplete count, table rows,
  // and "⚠ incomplete" badges update immediately — not just when the whole
  // run finishes.
  useEffect(() => {
    return subscribeFix((patch) => {
      if (!patch.parsed) return; // failed drugs: nothing to merge
      setDrugs(prev => prev.map(d => d.firestoreId === patch.firestoreId
        ? { ...d, ...patch.parsed, generic_name: patch.generic_name, drug_class: patch.drug_class || patch.parsed.drug_class }
        : d));
    });
  }, [subscribeFix]);

  // Build AI class list whenever drugs change
  useEffect(() => {
    if (!drugs.length) return;
    const map = {};
    drugs.forEach(d => {
      const cls = d.drug_class || 'Unknown';
      if (!map[cls]) map[cls] = { className: cls, drugs: [] };
      map[cls].drugs.push(d);
    });
    const list = Object.values(map).map(({ className, drugs: ds }) => ({
      className,
      count: ds.length,
      incomplete: ds.filter(isIncomplete).length,
    })).sort((a, b) => a.className.localeCompare(b.className));
    setAiClassList(list);
  }, [drugs]);

  // ── Seed Firestore ─────────────────────────────────────────────────────
  async function seedFirestore() {
    setSeeding(true);
    showToast('First run — seeding database…', 'info');
    try {
      const BATCH_SIZE = 499;
      for (let i = 0; i < seedDrugs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        seedDrugs.slice(i, i + BATCH_SIZE).forEach(drug => {
          const ref = doc(collection(db, 'drugs'), drug.id);
          batch.set(ref, { ...drug, seeded_at: serverTimestamp() });
        });
        await batch.commit();
      }
      showToast(`Seeded ${seedDrugs.length} drugs.`);
    } catch (err) { showToast('Seed failed: ' + err.message, 'error'); }
    setSeeding(false);
    await loadDrugs();
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  function patchClassState(className, update) {
    setClassAiState(prev => ({
      ...prev,
      [className]: { ...(prev[className] || {}), ...update },
    }));
  }

  function addClassLog(className, msg) {
    setClassAiState(prev => ({
      ...prev,
      [className]: {
        ...(prev[className] || {}),
        log: [...(prev[className]?.log || []), msg],
      },
    }));
  }

  // ── AI: Generate for one class ─────────────────────────────────────────
  // Round-based wave approach:
  //   Round 1 — Generate ALL new/incomplete drugs in parallel
  //             → Complete ones are saved to Firestore immediately in the background
  //             → Incomplete ones are collected for the next round
  //   Round 2 — Regenerate only the incomplete ones from round 1
  //             → Save the complete ones, collect still-incomplete
  //   Round 3 — Final attempt on remaining incomplete ones
  //             → Save complete ones; give up on any still incomplete (never saved)
  const MAX_ROUNDS = 3;

  async function runAiForClass(className) {
    if (runningClass) return;
    abortRef.current = false;
    setRunningClass(className);
    setExpandedClass(className);
    patchClassState(className, {
      status: 'running', log: [`🔍 Scanning class: ${className}…`],
      newDrugs: [], toFix: [], saved: [], incomplete: [], failed: [],
    });

    const log = (msg) => addClassLog(className, msg);

    try {
      // ── Step 1: get AI drug list ─────────────────────────────────────────
      const existingInClass = drugs.filter(d => d.drug_class === className);
      const existingNames   = existingInClass.map(d => (d.generic_name || '').toLowerCase());

      log(`📋 Fetching AI drug list for "${className}"…`);
      const listRes = await fetch('/api/drug-ai-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'class',
          className,
          knownDrugNames: existingInClass.map(d => d.generic_name),
        }),
      });
      if (!listRes.ok) throw new Error('AI class list request failed.');
      const listText = await listRes.text();

      const aiNames = [...listText.matchAll(/\*\*([^*]+)\*\*/g)]
        .map(m => m[1].trim())
        .filter(n => n.length > 1 && n.length < 60);
      const uniqueAiNames = [...new Set(aiNames)];
      log(`✅ AI found ${uniqueAiNames.length} drugs in "${className}"`);

      // ── Step 2: classify ─────────────────────────────────────────────────
      const newDrugs = uniqueAiNames.filter(n => !existingNames.includes(n.toLowerCase()));
      const toFix    = existingInClass.filter(d => !isDrugComplete(d)).map(d => d.generic_name);

      patchClassState(className, { newDrugs, toFix });
      log(`🆕 New drugs: ${newDrugs.length}  |  🔧 Incomplete (to fix): ${toFix.length}`);

      if (newDrugs.length === 0 && toFix.length === 0) {
        log('🎉 Class is already complete — nothing to do!');
        patchClassState(className, { status: 'done' });
        setRunningClass(null);
        return;
      }

      const saved    = [];
      const failed   = [];

      // ── Steps 3–5: wave rounds ───────────────────────────────────────────
      // pendingNames = drugs still needing generation this round
      let pendingNames = [...newDrugs, ...toFix];

      for (let round = 1; round <= MAX_ROUNDS; round++) {
        if (abortRef.current || pendingNames.length === 0) break;

        if (round === 1) {
          log(`\n⚡ Round 1 — Generating ${pendingNames.length} drugs (${PARALLEL_SAVES} at a time)…`);
        } else {
          log(`\n🔁 Round ${round} — Regenerating ${pendingNames.length} incomplete drug${pendingNames.length > 1 ? 's' : ''}…`);
        }

        const stillIncomplete = []; // collect drugs that need another round

        await parallelMap(pendingNames, async (name) => {
          if (abortRef.current) return;
          try {
            const { parsed, complete, missing } = await generateDrugOnce({ genericName: name, drugClass: className });

            if (complete) {
              // ── Save immediately in the background ──────────────────────
              await saveParsedDrug({ genericName: name, drugClass: className, parsed });
              saved.push(name);
              log(`  ✅ Saved: ${name}`);
              patchClassState(className, { saved: [...saved] });
            } else {
              if (round < MAX_ROUNDS) {
                // Queue for next round
                stillIncomplete.push(name);
                log(`  ⚠ Incomplete (${missing.map(g => g.label).join(', ')}) — will regenerate: ${name}`);
              } else {
                // Final round — save the best version we have anyway.
                // Duplicates/gaps will be handled later via the admin tools.
                await saveParsedDrug({ genericName: name, drugClass: className, parsed });
                saved.push(name);
                log(`  💾 Saved with gaps after ${MAX_ROUNDS} rounds: ${name} (missing: ${missing.map(g => g.label).join(', ')})`);
                patchClassState(className, { saved: [...saved] });
              }
            }
          } catch (e) {
            failed.push(name);
            log(`  ❌ Error: ${name} — ${e.message}`);
            patchClassState(className, { failed: [...failed] });
          }
        });

        pendingNames = stillIncomplete; // only regenerate the incomplete ones next round
      }

      const summary = [
        `✅ ${saved.length} saved`,
        pendingNames.length > 0 ? `⚠ ${pendingNames.length} could not be completed` : '',
        failed.length > 0       ? `❌ ${failed.length} failed` : '',
      ].filter(Boolean).join('  |  ');
      log(`\n🏁 Done — ${summary}`);

      patchClassState(className, { status: 'done', saved, failed });
      await loadDrugs();

    } catch (e) {
      log(`❌ Error: ${e.message}`);
      patchClassState(className, { status: 'error' });
    }

    setRunningClass(null);
  }

  function stopAi() {
    abortRef.current = true;
    if (runningClass) patchClassState(runningClass, { status: 'stopped' });
    setRunningClass(null);
  }

  // ── Derived lists ──────────────────────────────────────────────────────
  const allClasses = useMemo(() =>
    [...new Set(drugs.map(d => d.drug_class).filter(Boolean))].sort(), [drugs]);

  const allSubclasses = useMemo(() => {
    const base = drugs.filter(d => !filterClass || d.drug_class === filterClass);
    return [...new Set(base.map(d => d.drug_subclass).filter(Boolean))].sort();
  }, [drugs, filterClass]);

  const activeFilterCount = [filterClass, filterSubclass, filterStatus, filterIndication].filter(Boolean).length + (filterIncompleteOnly ? 1 : 0);

  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drugs.filter(drug => {
      const matchSearch = !q ||
        drug.generic_name?.toLowerCase().includes(q) ||
        drug.drug_class?.toLowerCase().includes(q) ||
        drug.drug_subclass?.toLowerCase().includes(q) ||
        drug.indications?.toLowerCase().includes(q) ||
        drug.primary_indications?.toLowerCase().includes(q) ||
        drug.overview?.toLowerCase().includes(q);
      const matchClass    = !filterClass    || drug.drug_class === filterClass;
      const matchSubclass = !filterSubclass || drug.drug_subclass === filterSubclass;
      const matchStatus   = !filterStatus   || drug.prescription_status === filterStatus;
      const matchInd      = !filterIndication ||
        drug.indications?.toLowerCase().includes(filterIndication.toLowerCase()) ||
        drug.primary_indications?.toLowerCase().includes(filterIndication.toLowerCase());
      const matchIncomplete = !filterIncompleteOnly || isIncomplete(drug);
      return matchSearch && matchClass && matchSubclass && matchStatus && matchInd && matchIncomplete;
    });
  }, [drugs, searchQuery, filterClass, filterSubclass, filterStatus, filterIndication, filterIncompleteOnly]);

  const stats = useMemo(() => ({
    total:      drugs.length,
    classes:    new Set(drugs.map(d => d.drug_class).filter(Boolean)).size,
    controlled: drugs.filter(d => d.prescription_status === 'Controlled').length,
    incomplete: drugs.filter(isIncomplete).length,
  }), [drugs]);

  const allSelected = filteredDrugs.length > 0 && filteredDrugs.every(d => selectedIds.has(d.firestoreId));
  const incompleteInView = useMemo(() => filteredDrugs.filter(isIncomplete), [filteredDrugs]);
  const selectedIncomplete = useMemo(
    () => filteredDrugs.filter(d => selectedIds.has(d.firestoreId) && isIncomplete(d)),
    [filteredDrugs, selectedIds]
  );

  function clearAllFilters() {
    setSearchQuery(''); setFilterClass(''); setFilterSubclass('');
    setFilterStatus(''); setFilterIndication(''); setFilterIncompleteOnly(false); setSelectedIds(new Set());
  }
  function toggleSelectAll() {
    allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredDrugs.map(d => d.firestoreId)));
  }
  function toggleSelect(fid) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(fid) ? n.delete(fid) : n.add(fid); return n; });
  }
  function promptDelete(fid)  { setDeleteTarget(fid); setConfirmDelete('single'); }
  function promptBulkDelete() { setConfirmDelete('bulk'); }

  // ── AI Insight: fix an incomplete drug's missing fields ───────────────────
  // Reuses the same generateDrugOnce/saveParsedDrug pipeline as the AI
  // Generate tab: generate once, retry once more if still incomplete, then
  // save the best version so progress is never lost even if a field or two
  // still can't be filled.
  async function fixOneDrugWithAI(drug) {
    if (fixingIds.has(drug.firestoreId) || bulkFixRunning || globalFixRunning) return;
    setFixingIds(prev => new Set(prev).add(drug.firestoreId));
    try {
      let { parsed, complete, missing } = await generateDrugOnce({
        genericName: drug.generic_name, drugClass: drug.drug_class,
      });
      if (!complete) {
        const retry = await generateDrugOnce({ genericName: drug.generic_name, drugClass: drug.drug_class });
        if (retry.missing.length <= missing.length) { parsed = retry.parsed; complete = retry.complete; missing = retry.missing; }
      }
      await saveParsedDrug({ genericName: drug.generic_name, drugClass: drug.drug_class, parsed });
      setDrugs(prev => prev.map(d => d.firestoreId === drug.firestoreId
        ? { ...d, ...parsed, generic_name: drug.generic_name, drug_class: drug.drug_class || parsed.drug_class }
        : d));
      showToast(
        complete ? `✅ AI completed: ${drug.generic_name}` : `⚠ Improved but still missing ${missing.map(g => g.label).join(', ')}: ${drug.generic_name}`,
        complete ? 'success' : 'info'
      );
    } catch (e) {
      showToast(`AI fix failed for ${drug.generic_name}: ${e.message}`, 'error');
    } finally {
      setFixingIds(prev => { const n = new Set(prev); n.delete(drug.firestoreId); return n; });
    }
  }

  // ── AI Insight: bulk-fix every incomplete drug currently in view ──────────
  async function bulkFixWithAI(drugsToFix) {
    if (bulkFixRunning || globalFixRunning || drugsToFix.length === 0) return;
    bulkFixAbortRef.current = false;
    setBulkFixRunning(true);
    setBulkFixProgress({ done: 0, total: drugsToFix.length });

    let done = 0, succeeded = 0, stillIncomplete = 0, failed = 0;

    await parallelMap(drugsToFix, async (drug) => {
      if (bulkFixAbortRef.current) return;
      setFixingIds(prev => new Set(prev).add(drug.firestoreId));
      try {
        let { parsed, complete, missing } = await generateDrugOnce({
          genericName: drug.generic_name, drugClass: drug.drug_class,
        });
        if (!complete) {
          const retry = await generateDrugOnce({ genericName: drug.generic_name, drugClass: drug.drug_class });
          if (retry.missing.length <= missing.length) { parsed = retry.parsed; complete = retry.complete; missing = retry.missing; }
        }
        await saveParsedDrug({ genericName: drug.generic_name, drugClass: drug.drug_class, parsed });
        setDrugs(prev => prev.map(d => d.firestoreId === drug.firestoreId
          ? { ...d, ...parsed, generic_name: drug.generic_name, drug_class: drug.drug_class || parsed.drug_class }
          : d));
        complete ? succeeded++ : stillIncomplete++;
      } catch (e) {
        failed++;
      } finally {
        setFixingIds(prev => { const n = new Set(prev); n.delete(drug.firestoreId); return n; });
        done++;
        setBulkFixProgress({ done, total: drugsToFix.length });
      }
    });

    setBulkFixRunning(false);
    setSelectedIds(new Set());
    showToast(
      bulkFixAbortRef.current
        ? `Stopped — ${succeeded} completed, ${stillIncomplete} still incomplete before stopping.`
        : `AI Insight done — ${succeeded} completed${stillIncomplete ? `, ${stillIncomplete} still incomplete` : ''}${failed ? `, ${failed} failed` : ''}.`,
      failed ? 'error' : stillIncomplete ? 'info' : 'success'
    );
  }

  function stopBulkFix() { bulkFixAbortRef.current = true; }

  async function confirmSingleDelete() {
    try {
      await deleteDoc(doc(db, 'drugs', deleteTarget));
      setDrugs(prev => prev.filter(d => d.firestoreId !== deleteTarget));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });
      showToast('Drug deleted.');
    } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
    setConfirmDelete(null); setDeleteTarget(null);
  }
  async function confirmBulkDelete() {
    const ids = [...selectedIds];
    try {
      const BATCH = 499;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = writeBatch(db);
        ids.slice(i, i + BATCH).forEach(id => batch.delete(doc(db, 'drugs', id)));
        await batch.commit();
      }
      setDrugs(prev => prev.filter(d => !selectedIds.has(d.firestoreId)));
      setSelectedIds(new Set());
      showToast(`${ids.length} drug${ids.length > 1 ? 's' : ''} deleted.`);
    } catch (err) { showToast('Bulk delete failed: ' + err.message, 'error'); }
    setConfirmDelete(null);
  }

  function openEdit(drug) {
    setEditingDrug(drug);
    const form = {};
    EDITABLE_FIELDS.forEach(f => { form[f.key] = drug[f.key] || ''; });
    setEditForm(form);
  }
  async function saveEdit() {
    if (!editForm.generic_name?.trim()) { showToast('Generic name is required.', 'error'); return; }
    setSaving(true);
    try {
      const updates = { ...editForm, last_updated: serverTimestamp() };
      await updateDoc(doc(db, 'drugs', editingDrug.firestoreId), updates);
      setDrugs(prev => prev.map(d => d.firestoreId === editingDrug.firestoreId ? { ...d, ...editForm } : d));
      showToast('Drug saved.');
      setEditingDrug(null);
    } catch (err) { showToast('Save failed: ' + err.message, 'error'); }
    setSaving(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:toast.type==='error'?'#FEF2F2':toast.type==='info'?'#EFF6FF':'#F0FDF4',border:`1px solid ${toast.type==='error'?'#FECACA':toast.type==='info'?'#BFDBFE':'#BBF7D0'}`,color:toast.type==='error'?'#991B1B':toast.type==='info'?'#1e40af':'#166534',padding:'12px 18px',borderRadius:10,fontWeight:600,fontSize:14,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',gap:8,maxWidth:360}}>
          {toast.type==='error'?<AlertTriangle className="w-4 h-4 flex-shrink-0"/>:toast.type==='info'?<RefreshCw className="w-4 h-4 flex-shrink-0"/>:'✅'}{toast.msg}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:'28px 24px',maxWidth:420,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}}>
            <div style={{width:48,height:48,background:'#FEF2F2',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
              <Trash2 className="w-5 h-5 text-red-600"/>
            </div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8}}>{confirmDelete==='bulk'?`Delete ${selectedIds.size} drug${selectedIds.size>1?'s':''}?`:'Delete this drug?'}</h3>
            <p style={{color:'#64748B',fontSize:14,marginBottom:24}}>This permanently removes the drug{confirmDelete==='bulk'&&selectedIds.size>1?'s':''} from the database.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={confirmDelete==='bulk'?confirmBulkDelete:confirmSingleDelete} style={{flex:1,padding:'11px',background:'#DC2626',color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}>Yes, Delete</button>
              <button onClick={()=>{setConfirmDelete(null);setDeleteTarget(null);}} style={{flex:1,padding:'11px',background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDrug && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'28px 24px',maxWidth:640,width:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:800}}>Edit: {editingDrug.generic_name}</h3>
              <button onClick={()=>setEditingDrug(null)} style={{background:'#F1F5F9',border:'none',borderRadius:8,padding:'6px 8px',cursor:'pointer'}}><X className="w-4 h-4 text-gray-500"/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {EDITABLE_FIELDS.map(field=>(
                <div key={field.key}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:5}}>{field.label}{field.required&&<span style={{color:'#DC2626'}}> *</span>}</label>
                  {field.type==='select'?(
                    <select value={editForm[field.key]||''} onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',background:'#fff'}}>
                      <option value="">Select...</option>{field.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ):field.type==='textarea'?(
                    <textarea value={editForm[field.key]||''} onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))} rows={3} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                  ):(
                    <input type="text" value={editForm[field.key]||''} onChange={e=>setEditForm(p=>({...p,[field.key]:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button onClick={saveEdit} disabled={saving} style={{flex:1,padding:'12px',background:saving?'#94A3B8':'linear-gradient(135deg,#1e40af,#1e3a8a)',color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Save className="w-4 h-4"/>{saving?'Saving…':'Save Changes'}
              </button>
              <button onClick={()=>setEditingDrug(null)} style={{flex:1,padding:'12px',background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl"><Shield className="w-6 h-6 text-primary-700"/></div>
          <div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-drug-muted text-sm">Manage the drug database</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={loadDrugs} className="flex items-center gap-2 px-4 py-2 border border-drug-border rounded-lg text-sm font-semibold text-drug-muted hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4"/> Refresh
          </button>
          <Link to="/admin/upload" className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4"/> Bulk Upload
          </Link>
          {globalFixRunning ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg border-1.5 border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold" style={{border:'1.5px solid #FDE68A'}}>
              <RefreshCw className="w-4 h-4 animate-spin"/>
              General AI Insight — {globalFixProgress.done}/{globalFixProgress.total}
              <button onClick={stopGlobalFix} className="underline hover:no-underline">Stop</button>
            </div>
          ) : (
            <button
              onClick={()=>{
                const incomplete = drugs.filter(isIncomplete);
                if (incomplete.length === 0) { showToast('Nothing to fix — every drug is already complete.'); return; }
                startGlobalFix(incomplete);
                showToast(`General AI Insight started — fixing ${incomplete.length} drugs silently in the background. Feel free to navigate away.`, 'info');
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{background:'linear-gradient(135deg,#F59E0B,#B45309)'}}
            >
              <Sparkles className="w-4 h-4"/> General AI Insight{stats.incomplete>0?` (${stats.incomplete})`:''}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {label:'Total Drugs',  value:stats.total,      icon:Database,      bg:'bg-primary-50',color:'text-drug-text',  ic:'text-primary-600'},
          {label:'Drug Classes', value:stats.classes,    icon:Filter,        bg:'bg-blue-50',  color:'text-blue-700',   ic:'text-blue-600'  },
          {label:'Controlled',   value:stats.controlled, icon:AlertTriangle, bg:'bg-red-50',   color:'text-red-700',    ic:'text-red-600'   },
          {label:'Incomplete',   value:stats.incomplete, icon:Sparkles,      bg:'bg-amber-50', color:'text-amber-700',  ic:'text-amber-500',
            onClick:()=>{setActiveTab('drugs');setFilterIncompleteOnly(true);setShowFilters(true);setSelectedIds(new Set());} },
        ].map(s=>(
          <div key={s.label} onClick={s.onClick} role={s.onClick?'button':undefined} tabIndex={s.onClick?0:undefined}
            onKeyDown={s.onClick?(e=>{if(e.key==='Enter')s.onClick();}):undefined}
            className={`bg-white border rounded-xl p-5 transition-all ${
              s.onClick
                ? `cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${filterIncompleteOnly && s.label==='Incomplete' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-drug-border hover:border-amber-300'}`
                : 'border-drug-border'
            }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-drug-muted">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{loading?'—':s.value}</p>
                {s.onClick && <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Tap to view →</p>}
              </div>
              <div className={`p-2.5 ${s.bg} rounded-lg`}><s.icon className={`w-5 h-5 ${s.ic}`}/></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-drug-border">
        {[
          {id:'drugs', label:'Drug List',   icon:Database},
          {id:'ai',    label:'AI Generate', icon:Sparkles},
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab===tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-drug-muted hover:text-drug-text'
            }`}>
            <tab.icon className="w-4 h-4"/>{tab.label}
            {tab.id==='ai' && stats.incomplete>0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                {stats.incomplete}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ DRUG LIST TAB ════════════════════════════ */}
      {activeTab === 'drugs' && (
        <>
          {/* Search + Filter Bar */}
          <div className="bg-white border border-drug-border rounded-xl p-4 mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type="text" value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setSelectedIds(new Set());}}
                  placeholder="Search name, class, subclass, indication..."
                  className="w-full pl-10 pr-4 py-2.5 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"/>
              </div>
              <button onClick={()=>setShowFilters(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:8,border:showFilters?'1.5px solid #1e40af':'1.5px solid #E2E8F0',background:showFilters?'#EFF6FF':'#fff',color:showFilters?'#1e40af':'#64748B',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
                <Filter className="w-4 h-4"/>Filters
                {activeFilterCount>0&&<span style={{background:'#1e40af',color:'#fff',borderRadius:'50%',width:18,height:18,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900}}>{activeFilterCount}</span>}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters?'rotate-180':''}`}/>
              </button>
              {selectedIds.size>0&&(
                <button onClick={promptBulkDelete} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:8,border:'1.5px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
                  <Trash2 className="w-4 h-4"/>Delete {selectedIds.size} selected
                </button>
              )}
              {!bulkFixRunning && !globalFixRunning && selectedIncomplete.length>0 && (
                <button onClick={()=>bulkFixWithAI(selectedIncomplete)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:8,border:'1.5px solid #FDE68A',background:'#FFFBEB',color:'#B45309',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
                  <Sparkles className="w-4 h-4"/>AI Insight: fix {selectedIncomplete.length} selected
                </button>
              )}
              {!bulkFixRunning && !globalFixRunning && selectedIds.size===0 && incompleteInView.length>0 && (
                <button onClick={()=>bulkFixWithAI(incompleteInView)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:8,border:'1.5px solid #FDE68A',background:'#FFFBEB',color:'#B45309',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
                  <Sparkles className="w-4 h-4"/>AI Insight: fix all {incompleteInView.length} incomplete
                </button>
              )}
              {bulkFixRunning && (
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderRadius:8,border:'1.5px solid #FDE68A',background:'#FFFBEB',color:'#B45309',fontWeight:700,fontSize:13,whiteSpace:'nowrap'}}>
                  <RefreshCw className="w-4 h-4 animate-spin"/>
                  Fixing {bulkFixProgress.done} of {bulkFixProgress.total}…
                  <button onClick={stopBulkFix} style={{background:'none',border:'none',cursor:'pointer',color:'#B45309',textDecoration:'underline',fontWeight:700,fontSize:13}}>Stop</button>
                </div>
              )}
            </div>
            {bulkFixRunning && (
              <div style={{height:6,background:'#FEF3C7',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${bulkFixProgress.total?Math.round((bulkFixProgress.done/bulkFixProgress.total)*100):0}%`,background:'#F59E0B',transition:'width 0.2s'}}/>
              </div>
            )}
            {showFilters&&(
              <div className="pt-3 border-t border-drug-border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-drug-muted uppercase tracking-wide mb-1.5">Drug Class</label>
                    <select value={filterClass} onChange={e=>{setFilterClass(e.target.value);setFilterSubclass('');setSelectedIds(new Set());}} className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                      <option value="">All Classes</option>{allClasses.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-drug-muted uppercase tracking-wide mb-1.5">Drug Subclass</label>
                    <select value={filterSubclass} onChange={e=>{setFilterSubclass(e.target.value);setSelectedIds(new Set());}} className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                      <option value="">All Subclasses</option>{allSubclasses.map(sc=><option key={sc} value={sc}>{sc}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-drug-muted uppercase tracking-wide mb-1.5">Rx Status</label>
                    <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setSelectedIds(new Set());}} className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                      <option value="">All Statuses</option>{ALL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-drug-muted uppercase tracking-wide mb-1.5">Indication</label>
                    <input type="text" value={filterIndication} onChange={e=>{setFilterIndication(e.target.value);setSelectedIds(new Set());}} placeholder="e.g. hypertension" className="w-full px-3 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"/>
                  </div>
                </div>
                {activeFilterCount>0&&(
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {filterIncompleteOnly&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#FFFBEB',color:'#B45309',borderRadius:20,fontSize:12,fontWeight:700}}>⚠ Incomplete only<button onClick={()=>setFilterIncompleteOnly(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#B45309',padding:0}}>×</button></span>}
                    {filterClass&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>Class: {filterClass}<button onClick={()=>{setFilterClass('');setFilterSubclass('');}} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',padding:0}}>×</button></span>}
                    {filterSubclass&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>Subclass: {filterSubclass}<button onClick={()=>setFilterSubclass('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',padding:0}}>×</button></span>}
                    {filterStatus&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>Status: {filterStatus}<button onClick={()=>setFilterStatus('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',padding:0}}>×</button></span>}
                    {filterIndication&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:'#EFF6FF',color:'#1e40af',borderRadius:20,fontSize:12,fontWeight:700}}>Indication: {filterIndication}<button onClick={()=>setFilterIndication('')} style={{background:'none',border:'none',cursor:'pointer',color:'#1e40af',padding:0}}>×</button></span>}
                    <button onClick={clearAllFilters} style={{padding:'3px 10px',background:'none',border:'1px solid #E2E8F0',borderRadius:20,fontSize:12,fontWeight:700,color:'#64748B',cursor:'pointer'}}>Clear all</button>
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-drug-muted pt-1">
              {loading?'Loading…':seeding?'Seeding database…':filteredDrugs.length===drugs.length?`${drugs.length} drugs`:`${filteredDrugs.length} of ${drugs.length} drugs matching filters`}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-drug-border">
                    <th className="px-4 py-3 w-10"><button onClick={toggleSelectAll} className="flex items-center justify-center">{allSelected?<CheckSquare className="w-4 h-4 text-primary-600"/>:<Square className="w-4 h-4 text-gray-400"/>}</button></th>
                    <th className="text-left px-4 py-3 font-semibold text-drug-muted">Drug Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-drug-muted hidden sm:table-cell">Class</th>
                    <th className="text-left px-4 py-3 font-semibold text-drug-muted hidden md:table-cell">Subclass</th>
                    <th className="text-left px-4 py-3 font-semibold text-drug-muted">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-drug-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading||seeding?(
                    <tr><td colSpan="6" className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-primary-300 mx-auto mb-3 animate-spin"/>
                      <p className="text-drug-muted">{seeding?'Seeding 280 drugs…':'Loading…'}</p>
                    </td></tr>
                  ):filteredDrugs.length===0?(
                    <tr><td colSpan="6" className="text-center py-12">
                      <Search className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                      <p className="text-drug-muted font-medium">No drugs match</p>
                      <button onClick={clearAllFilters} className="mt-3 text-primary-600 text-sm font-semibold hover:underline">Clear filters</button>
                    </td></tr>
                  ):filteredDrugs.map(drug=>(
                    <tr key={drug.firestoreId} className={`border-b border-drug-border hover:bg-gray-50 transition-colors ${selectedIds.has(drug.firestoreId)?'bg-blue-50':isIncomplete(drug)?'bg-amber-50/40':''}`}>
                      <td className="px-4 py-3"><button onClick={()=>toggleSelect(drug.firestoreId)} className="flex items-center justify-center">{selectedIds.has(drug.firestoreId)?<CheckSquare className="w-4 h-4 text-primary-600"/>:<Square className="w-4 h-4 text-gray-300"/>}</button></td>
                      <td className="px-4 py-3">
                        <Link to={`/drug/${drug.id}`} className="font-semibold text-primary-700 hover:underline">{drug.generic_name}</Link>
                        {isIncomplete(drug)&&<span className="ml-2 text-xs text-amber-600 font-bold">⚠ incomplete</span>}
                        <div className="sm:hidden text-xs text-drug-muted mt-0.5">{drug.drug_class}</div>
                      </td>
                      <td className="px-4 py-3 text-drug-muted hidden sm:table-cell">{drug.drug_class}</td>
                      <td className="px-4 py-3 text-drug-muted hidden md:table-cell text-xs">{drug.drug_subclass||'—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${drug.prescription_status==='OTC'?'bg-green-100 text-green-700':drug.prescription_status==='Controlled'?'bg-red-100 text-red-700':'bg-blue-100 text-blue-700'}`}>
                          {drug.prescription_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isIncomplete(drug) && (
                            <button onClick={()=>fixOneDrugWithAI(drug)} disabled={fixingIds.has(drug.firestoreId)||bulkFixRunning||globalFixRunning}
                              className={`p-2 rounded-lg transition-colors ${fixingIds.has(drug.firestoreId)?'text-amber-400 cursor-wait':'text-amber-600 hover:bg-amber-50'}`}
                              title={globalFixRunning ? 'General AI Insight is already running' : 'AI Insight: fix missing fields'}>
                              {fixingIds.has(drug.firestoreId) ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            </button>
                          )}
                          <button onClick={()=>openEdit(drug)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4"/></button>
                          <button onClick={()=>promptDelete(drug.firestoreId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredDrugs.length>0&&(
              <div className="px-4 py-3 border-t border-drug-border bg-gray-50 flex items-center justify-between text-sm text-drug-muted">
                <span>{selectedIds.size>0?`${selectedIds.size} of ${filteredDrugs.length} selected`:`${filteredDrugs.length} drug${filteredDrugs.length!==1?'s':''}`}</span>
                {selectedIds.size>0&&<button onClick={()=>setSelectedIds(new Set())} className="text-primary-600 font-medium hover:underline">Clear selection</button>}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════ AI GENERATE TAB ══════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="space-y-4">

          <ConditionTagBackfill />

          {/* Intro banner */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5"/>
              <div>
                <h2 className="font-bold text-primary-900 mb-1">AI Drug Generator</h2>
                <p className="text-sm text-primary-700 leading-relaxed">
                  For each class, the AI <strong>generates all missing drugs</strong> and <strong>fixes incomplete ones</strong>.
                  Every drug is fully generated and validated <em>before</em> being saved —
                  no drug with missing sections is ever written to the database.
                  If a drug's AI response is incomplete, it retries once automatically.
                </p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Zap className="w-3.5 h-3.5 text-amber-500"/>{PARALLEL_SAVES} parallel per class
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    ✅ Validates before saving
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    🔁 Auto-retries incomplete
                  </span>
                </div>
                {/* Required fields reference */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {REQUIRED_FIELD_GROUPS.map(g => (
                    <span key={g.label} style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(99,102,241,0.1)',color:'#4338ca',fontWeight:600}}>{g.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stop button */}
          {runningClass && (
            <button onClick={stopAi} className="w-full py-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
              <X className="w-4 h-4"/> Stop ({runningClass})
            </button>
          )}

          {/* Class list */}
          {loading ? (
            <div className="text-center py-16"><RefreshCw className="w-8 h-8 text-primary-300 mx-auto animate-spin mb-3"/><p className="text-drug-muted">Loading drug classes…</p></div>
          ) : (
            <div className="space-y-2">
              {aiClassList.map(({ className, count, incomplete }) => {
                const state      = classAiState[className] || {};
                const isRunning  = runningClass === className;
                const isDone     = state.status === 'done';
                const isError    = state.status === 'error';
                const isStopped  = state.status === 'stopped';
                const isExpanded = expandedClass === className;

                return (
                  <div key={className} className={`bg-white border rounded-xl overflow-hidden transition-all ${isRunning?'border-primary-400 shadow-md':isDone?'border-green-300':isError?'border-red-300':'border-drug-border'}`}>
                    {/* Class row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={()=>setExpandedClass(isExpanded?null:className)} className="p-1 text-drug-muted hover:text-drug-text">
                        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded?'rotate-90':''}`}/>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-drug-text">{className}</span>
                          <span className="text-xs text-drug-muted">{count} drug{count!==1?'s':''}</span>
                          {incomplete>0&&<span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">⚠ {incomplete} incomplete</span>}
                          {isDone&&<span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✅ Done</span>}
                          {isError&&<span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">❌ Error</span>}
                          {isStopped&&<span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">⏹ Stopped</span>}
                          {isRunning&&<span className="text-xs font-bold px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/>Running…</span>}
                        </div>
                        {/* Live progress counters */}
                        {(state.saved?.length>0 || state.incomplete?.length>0 || state.failed?.length>0) && (
                          <div className="text-xs mt-0.5 flex gap-3 flex-wrap">
                            {state.saved?.length>0     && <span className="text-green-600 font-semibold">✅ {state.saved.length} saved</span>}
                            {state.incomplete?.length>0 && <span className="text-amber-600 font-semibold">⚠ {state.incomplete.length} not saved (incomplete)</span>}
                            {state.failed?.length>0    && <span className="text-red-600 font-semibold">❌ {state.failed.length} failed</span>}
                          </div>
                        )}
                      </div>

                      {/* Generate button */}
                      <button
                        onClick={()=>runAiForClass(className)}
                        disabled={!!runningClass}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                          isRunning       ? 'bg-primary-100 text-primary-600 cursor-not-allowed'
                          : runningClass  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isDone        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {isRunning
                          ? <><RefreshCw className="w-3 h-3 animate-spin"/>Running</>
                          : isDone
                          ? <><RefreshCw className="w-3 h-3"/>Re-run</>
                          : <><PlayCircle className="w-3 h-3"/>Generate</>}
                      </button>
                    </div>

                    {/* Expanded log */}
                    {isExpanded && state.log && (
                      <div className="border-t border-drug-border bg-gray-950 px-4 py-3 max-h-80 overflow-y-auto">
                        <div className="font-mono text-xs leading-relaxed space-y-0.5">
                          {state.log.map((line, i) => (
                            <div key={i} className={
                              line.includes('✅') ? 'text-green-400' :
                              line.includes('❌') ? 'text-red-400'   :
                              line.includes('⚠')  ? 'text-amber-400' :
                              line.includes('⚡') || line.includes('🆕') ? 'text-blue-400' :
                              line.includes('🏁') ? 'text-purple-400' :
                              line.includes('🔧') ? 'text-amber-300'  :
                              line.includes('⏭')  ? 'text-gray-500'  :
                              'text-gray-300'
                            }>{line}</div>
                          ))}
                          {isRunning && <div className="text-primary-400 animate-pulse">▌</div>}
                        </div>
                      </div>
                    )}

                    {isExpanded && !state.log && (
                      <div className="border-t border-drug-border px-4 py-3 text-sm text-drug-muted">
                        Press <strong>Generate</strong> — the system will find missing drugs, fix incomplete ones,
                        and only save each drug once <em>all</em> required sections are verified complete.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
