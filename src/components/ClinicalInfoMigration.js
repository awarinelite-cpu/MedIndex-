// src/components/ClinicalInfoMigration.js
//
// One-time migration for the condition-clinical-info storage fix: moves
// data out of the old app_config/condition_clinical_info document (which
// stored every condition as a field on one document, and started failing
// to write once it grew past Firestore's 1 MB per-document limit) into the
// new condition_clinical_info collection (one document per condition).
//
// Self-hiding: checks on mount whether the old document still exists. If
// it doesn't (already migrated, or a fresh install that never used the old
// shape), this renders nothing at all.
import React, { useEffect, useState } from 'react';
import { doc, getDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { AlertTriangle, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react';
import { db } from '../firebase';
import { LEGACY_DOC_REF_PATH } from '../hooks/useConditionClinicalInfo';

const NEW_COLLECTION = 'condition_clinical_info';

export default function ClinicalInfoMigration({ showToast }) {
  const [legacyCount, setLegacyCount] = useState(null); // null = still checking, 0/undefined = nothing to migrate
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, ...LEGACY_DOC_REF_PATH));
        const conditions = snap.exists() ? (snap.data().conditions || {}) : {};
        setLegacyCount(Object.keys(conditions).length);
      } catch {
        setLegacyCount(0); // can't check — don't block the admin page over this
      }
    })();
  }, []);

  if (legacyCount === null || legacyCount === 0) return done ? (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-sm text-green-800 mb-4">
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      Clinical info migrated to per-condition documents — this one-time step is done.
    </div>
  ) : null;

  const migrate = async () => {
    setRunning(true);
    try {
      const snap = await getDoc(doc(db, ...LEGACY_DOC_REF_PATH));
      const conditions = snap.exists() ? (snap.data().conditions || {}) : {};
      const entries = Object.entries(conditions);

      const BATCH = 400;
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = writeBatch(db);
        for (const [conditionId, info] of entries.slice(i, i + BATCH)) {
          batch.set(doc(db, NEW_COLLECTION, conditionId), { ...info, migratedAt: serverTimestamp() });
        }
        await batch.commit();
      }

      await deleteDoc(doc(db, ...LEGACY_DOC_REF_PATH));
      setLegacyCount(0);
      setDone(true);
      showToast && showToast(`Migrated clinical info for ${entries.length} condition${entries.length === 1 ? '' : 's'} to their own documents.`);
    } catch (err) {
      showToast && showToast('Migration failed: ' + err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-amber-900 text-sm">One-time fix needed: clinical info storage</h3>
          <p className="text-sm text-amber-800 leading-relaxed mt-1">
            Condition clinical info used to be stored as one field per condition inside a single
            document, which just hit Firestore's 1&nbsp;MB document size limit — that's the
            "cannot be written because its size... exceeds the maximum allowed size" error.
            This moves the {legacyCount} condition{legacyCount === 1 ? '' : 's'} already saved there
            into their own documents (unaffected by this limit going forward), then removes the old
            document. Nothing is lost.
          </p>
          <button
            onClick={migrate}
            disabled={running}
            className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Migrate {legacyCount} condition{legacyCount === 1 ? '' : 's'} now
          </button>
        </div>
      </div>
    </div>
  );
}
