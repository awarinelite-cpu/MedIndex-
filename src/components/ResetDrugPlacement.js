// src/components/ResetDrugPlacement.js
//
// Admin tool: re-places EVERY drug under the conditions it actually treats,
// judged only from what's written on the drug itself (its class, subclass,
// generic name, indications and primary indications) matched against each
// condition's keywords — then decides Main vs Adjunct per condition.
//
//  • Preview first: nothing is written until the admin reviews the summary
//    and types RESET.
//  • Undoable: each changed drug keeps its previous tags/roles in
//    `reset_backup`, and "Undo last reset" restores them.
//  • Safe by design: drugs with no indications text, combination regimens,
//    seed-only drugs and tags for conditions that no longer exist are left
//    exactly as they are.
import React, { useMemo, useState } from 'react';
import { doc, writeBatch, deleteField } from 'firebase/firestore';
import { RotateCcw, AlertTriangle, Undo2, Eye } from 'lucide-react';
import { db } from '../firebase';
import { useDrugs } from '../hooks/useDrugs';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { classifyDrugsByRole, getMainIndicationStrength } from '../utils/drugRoleClassification';

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasIndications = (d) => !!String(d.indications || d.primary_indications || '').trim();

function buildPlan(drugs, conditions, strict = false) {
  const knownIds = new Set(conditions.map(c => c.id));
  const labelById = new Map(conditions.map(c => [c.id, c.label]));

  const eligible = drugs.filter(d => !d._seed && d.id && !d.is_combination_therapy && hasIndications(d));
  const skipped = {
    noIndications: drugs.filter(d => !d._seed && !d.is_combination_therapy && !hasIndications(d)).length,
  };

  // 1) New tags: every condition whose keywords are supported by the drug's own text.
  const finalTags = new Map();
  for (const d of eligible) {
    const old = Array.isArray(d.condition_tags) ? d.condition_tags : [];
    const keptUnknown = old.filter(t => !knownIds.has(t));
    // Strict: only class/name matches or a first-indication match keep a link; passing mentions are unlinked.
    const minStrength = strict ? 2 : 1;
    const matched = conditions.filter(c => getMainIndicationStrength(d, c) >= minStrength).map(c => c.id);
    finalTags.set(d, [...new Set([...keptUnknown, ...matched])]);
  }

  // 2) Roles per condition, over its new member list.
  const finalRoles = new Map(eligible.map(d => {
    const old = d.condition_roles || {};
    const keep = {};
    Object.keys(old).forEach(k => { if (!knownIds.has(k)) keep[k] = old[k]; });
    return [d, keep];
  }));
  for (const c of conditions) {
    const members = eligible.filter(d => finalTags.get(d).includes(c.id));
    if (members.length === 0) continue;
    const r = classifyDrugsByRole(members, c, { ignoreStored: true });
    r.main.forEach(d => { finalRoles.get(d)[c.id] = 'main'; });
    r.adjunct.forEach(d => { finalRoles.get(d)[c.id] = 'adjunct'; });
  }

  // 3) Diff against what's stored now.
  const changes = [];
  let added = 0, removed = 0, roleChanges = 0;
  const removedExamples = [];
  const perCondRemoved = new Map();
  for (const d of eligible) {
    const oldTags = Array.isArray(d.condition_tags) ? d.condition_tags : [];
    const oldRoles = d.condition_roles || {};
    const newTags = finalTags.get(d);
    const newRoles = finalRoles.get(d);
    const a = newTags.filter(t => !oldTags.includes(t));
    const r = oldTags.filter(t => knownIds.has(t) && !newTags.includes(t));
    const rc = Object.keys(newRoles).filter(k => oldRoles[k] !== newRoles[k]).length
             + Object.keys(oldRoles).filter(k => !(k in newRoles)).length;
    if (a.length === 0 && r.length === 0 && sameJson(oldRoles, newRoles)) continue;
    added += a.length; removed += r.length; roleChanges += rc;
    r.forEach(t => {
      perCondRemoved.set(t, (perCondRemoved.get(t) || 0) + 1);
      if (removedExamples.length < 12) removedExamples.push(`${d.generic_name} ✕ ${labelById.get(t)}`);
    });
    changes.push({ drug: d, tags: newTags, roles: newRoles, oldTags, oldRoles });
  }
  const topRemoved = [...perCondRemoved.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
    .map(([id, n]) => `${labelById.get(id)} (−${n})`);

  return { changes, added, removed, roleChanges, removedExamples, topRemoved, skipped, checked: eligible.length };
}

export default function ResetDrugPlacement({ showToast }) {
  const { drugs } = useDrugs();
  const { customConditionsBySystem, hiddenConditionIdsBySystem } = useCustomConditions();
  const [plan, setPlan] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [strict, setStrict] = useState(false);

  const conditions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const systems = new Set([...Object.keys(SYSTEM_CONDITIONS), ...Object.keys(customConditionsBySystem || {})]);
    systems.forEach(sys => {
      const hidden = new Set((hiddenConditionIdsBySystem || {})[sys] || []);
      [...(SYSTEM_CONDITIONS[sys] || []), ...((customConditionsBySystem || {})[sys] || [])].forEach(c => {
        if (!c?.id || hidden.has(c.id) || seen.has(c.id)) return;
        seen.add(c.id);
        out.push(c);
      });
    });
    return out;
  }, [customConditionsBySystem, hiddenConditionIdsBySystem]);

  const backupCount = useMemo(() => drugs.filter(d => d.reset_backup).length, [drugs]);

  const runBatches = async (items, apply) => {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach(it => batch.update(doc(db, 'drugs', it.id), apply(it)));
      await batch.commit();
    }
  };

  const preview = (strictMode = strict) => { setConfirmText(''); setPlan(buildPlan(drugs, conditions, strictMode)); };
  const toggleStrict = (e) => { setStrict(e.target.checked); if (plan) preview(e.target.checked); };

  const applyReset = async () => {
    if (!plan || confirmText !== 'RESET' || busy) return;
    setBusy(true);
    try {
      const byId = new Map(plan.changes.map(c => [c.drug.id, c]));
      const now = Date.now();
      await runBatches(plan.changes.map(c => ({ id: c.drug.id })), ({ id }) => {
        const c = byId.get(id);
        return {
          condition_tags: c.tags,
          condition_roles: c.roles,
          reset_backup: { condition_tags: c.oldTags, condition_roles: c.oldRoles, at: now },
        };
      });
      showToast?.(`Reset done: ${plan.changes.length} drugs updated.`, 'success');
      setPlan(null);
    } catch (err) {
      console.error('Reset failed:', err);
      showToast?.(`Reset failed: ${err.message}`, 'error');
    } finally { setBusy(false); setConfirmText(''); }
  };

  const undo = async () => {
    if (busy || backupCount === 0) return;
    if (!window.confirm(`Restore the previous placement of ${backupCount} drugs?`)) return;
    setBusy(true);
    try {
      const items = drugs.filter(d => d.reset_backup).map(d => ({ id: d.id, b: d.reset_backup }));
      const byId = new Map(items.map(i => [i.id, i.b]));
      await runBatches(items, ({ id }) => {
        const b = byId.get(id);
        return { condition_tags: b.condition_tags || [], condition_roles: b.condition_roles || {}, reset_backup: deleteField() };
      });
      showToast?.('Previous placement restored.', 'success');
    } catch (err) {
      console.error('Undo failed:', err);
      showToast?.(`Undo failed: ${err.message}`, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 bg-white border border-drug-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <RotateCcw className="w-4 h-4 text-red-600" />
        <h3 className="text-sm font-bold">Reset drug placement</h3>
      </div>
      <p className="text-xs text-drug-muted mb-3">
        Re-places every drug under the conditions its own class, indications and uses support, and re-sorts Main vs Adjunct. You'll see a preview first.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => preview()} disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
          <Eye className="w-3.5 h-3.5" /> Preview reset
        </button>
        {backupCount > 0 && (
          <button onClick={undo} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
            <Undo2 className="w-3.5 h-3.5" /> Undo last reset ({backupCount})
          </button>
        )}
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={strict} onChange={toggleStrict} disabled={busy} className="mt-0.5 accent-red-600" />
        <span>
          <b>Strict mode</b> — keep a drug under a condition only if its class/name matches or the condition is its first listed indication. Drugs that only mention it in passing are unlinked.
        </span>
      </label>

      {plan && (
        <div className="mt-3 border border-red-200 bg-red-50/50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Preview{strict ? ' (strict)' : ''} — nothing saved yet</div>
          <div>Checked {plan.checked} drugs against {conditions.length} conditions.</div>
          <div><b>{plan.changes.length}</b> drugs will change: <b>+{plan.added}</b> condition links added, <b>−{plan.removed}</b> removed, <b>{plan.roleChanges}</b> Main/Adjunct changes.</div>
          {plan.skipped.noIndications > 0 && <div className="text-drug-muted">{plan.skipped.noIndications} drugs have no indications written — left untouched.</div>}
          {plan.topRemoved.length > 0 && <div>Most removals: {plan.topRemoved.join(', ')}</div>}
          {plan.removedExamples.length > 0 && (
            <div className="text-drug-muted">Examples removed: {plan.removedExamples.join(' · ')}</div>
          )}
          {plan.changes.length === 0 ? (
            <div className="font-semibold text-green-700">Everything is already placed correctly.</div>
          ) : (
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder='Type RESET to confirm'
                className="border border-red-300 rounded-lg px-2 py-1 text-xs w-44" />
              <button onClick={applyReset} disabled={confirmText !== 'RESET' || busy}
                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg disabled:opacity-40">
                {busy ? 'Working…' : `Apply to ${plan.changes.length} drugs`}
              </button>
              <button onClick={() => setPlan(null)} disabled={busy} className="text-xs text-drug-muted underline">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
