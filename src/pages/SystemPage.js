import React, { useMemo, useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Siren,
  Pill, Grid3X3, List, ArrowLeft,
  Sparkles, RefreshCw, Save, AlertTriangle, Download, Upload, BookOpen, Merge, X,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { useAiInsight } from '../context/AiInsightContext';
import { getSystemById, ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { getDrugsForSystem } from '../utils/systemMatch';
import { groupDrugsByCondition, getDrugConditions, SYSTEM_CONDITIONS } from '../data/systemConditions';
import { parseAiConditionList } from '../utils/parseAiConditionList';
import { parseConditionClinicalInfo } from '../utils/parseConditionClinicalInfo';
import { fetchSystemConditionsList, fetchConditionClinicalInfo } from '../utils/aiDrugSave';
import { useCustomConditions, addCustomConditions, removeCondition, renameCondition, slugifyConditionLabel, normalizeConditionLabel } from '../hooks/useCustomConditions';
import { mergeConditions } from '../utils/mergeConditions';
import { useConditionClinicalInfo, saveConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import ConditionSection from '../components/ConditionSection';

const ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Grid3X3, Siren,
};


/* ── Main page ───────────────────────────────────────────────────────────── */
/* ── AI expansion for a whole system: suggest new condition categories ──── */
function AiSystemConditionsFallback({ systemId, systemName, existingLabels }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const { enqueueAutoFillCondition } = useAiInsight();

  const cacheKey = `ai_system_conditions_${systemId}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [addAllState, setAddAllState] = useState('idle'); // idle | running | done
  const existingLabelSet = useMemo(
    () => new Set(existingLabels.map(normalizeConditionLabel)),
    [existingLabels]
  );

  if (!isAdmin) return null; // only admins can curate condition taxonomy

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    try {
      const full = await fetchSystemConditionsList({ systemName, existingLabels, endpoint: provider.endpoint });
      setText(full);
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI suggestions.');
      setState('error');
    }
  };

  const items = state === 'done' ? parseAiConditionList(text) : [];

  const addOne = async (item) => {
    const id = slugifyConditionLabel(item.label);
    if (existingLabelSet.has(normalizeConditionLabel(item.label))) return; // already exists — no-op
    setAddingId(id);
    setError('');
    try {
      await addCustomConditions(systemId, [{ id, label: item.label, icon: item.icon, keywords: item.keywords }]);
      setAddedIds(prev => new Set(prev).add(id));
      // Automatically start filling this brand-new condition with drugs —
      // no need to open it and click "Find more drugs" / "Save All" manually.
      enqueueAutoFillCondition({ conditionId: id, label: item.label, conditionKeywords: item.keywords, systemName, endpoint: provider.endpoint });
    } catch (e) {
      setError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
    } finally {
      setAddingId(null);
    }
  };

  const addAll = async () => {
    setAddAllState('running');
    setError('');
    const toAdd = items
      .filter(item => {
        const id = slugifyConditionLabel(item.label);
        return !addedIds.has(id) && !existingLabelSet.has(normalizeConditionLabel(item.label));
      })
      .map(item => ({ id: slugifyConditionLabel(item.label), label: item.label, icon: item.icon, keywords: item.keywords }));
    if (toAdd.length === 0) {
      setAddAllState('idle');
      return;
    }
    try {
      await addCustomConditions(systemId, toAdd);
      setAddedIds(prev => new Set([...prev, ...toAdd.map(c => c.id)]));
      setAddAllState('done');
      // Automatically start filling every newly created condition with
      // drugs, one at a time (progress shows in the floating widget) — no
      // manual "Save All" click needed for any of them.
      toAdd.forEach(c => enqueueAutoFillCondition({ conditionId: c.id, label: c.label, conditionKeywords: c.keywords, systemName, endpoint: provider.endpoint }));
      // No reload needed — addedIds above updates the UI immediately, and
      // the live useCustomConditions() listener confirms it from Firestore
      // in the background.
    } catch (e) {
      setError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
      setAddAllState('idle');
    }
  };

  return (
    <div className="mt-6 bg-white border border-drug-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 bg-violet-50">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <span className="font-bold text-drug-text truncate">AI: More conditions for {systemName}</span>
        </div>
        {state === 'idle' && (
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Find more conditions
          </button>
        )}
        {state === 'done' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {items.some(item => !addedIds.has(slugifyConditionLabel(item.label)) && !existingLabelSet.has(normalizeConditionLabel(item.label))) && addAllState !== 'running' && (
              <button
                onClick={addAll}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg"
              >
                <Save className="w-3 h-3" /> Add All
              </button>
            )}
            <button
              onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {state === 'loading' && (
        <div className="p-6 text-center">
          <RefreshCw className="w-6 h-6 text-violet-400 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-drug-muted">Gathering condition categories for {systemName}…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {state === 'done' && (
        addAllState === 'done' ? (
          <div className="p-5 text-center text-sm text-green-700 bg-green-50">
            ✓ Added — refreshing to show the new condition cards…
          </div>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-drug-muted">{text}</p>
        ) : (
          <div>
            {error && (
              <div style={{
                margin: '12px 16px',
                padding: '14px 16px',
                background: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: '#991B1B',
                lineHeight: 1.5,
              }}>
                ⚠️ {error}
              </div>
            )}
            {items.map((item, i) => {
              const id = slugifyConditionLabel(item.label);
              const added = addedIds.has(id);
              const isDuplicate = existingLabelSet.has(normalizeConditionLabel(item.label));
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-5 py-3 ${i !== items.length - 1 ? 'border-b border-drug-border' : ''}`}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-drug-muted truncate">{item.keywords.slice(0, 4).join(', ')}…</div>
                  </div>
                  {added ? (
                    <span className="text-xs font-bold text-green-600 flex-shrink-0">✓ Added</span>
                  ) : isDuplicate ? (
                    <span className="text-xs font-semibold text-drug-muted flex-shrink-0">Already exists</span>
                  ) : (
                    <button
                      onClick={() => addOne(item)}
                      disabled={addingId === id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50 flex-shrink-0"
                    >
                      {addingId === id ? 'Adding…' : '+ Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ── Bulk-add conditions from a CSV file ─────────────────────────────────── */
function deriveKeywordsFromLabel(label) {
  const norm = String(label || '').toLowerCase().trim();
  const stopwords = new Set(['and', 'the', 'of', 'with', 'a', 'an', 'in', 'on', 'to']);
  const words = norm.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
  return Array.from(new Set([norm, ...words]));
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Maps common alternate/source-material system names to this app's actual
// system ids (e.g. a nursing-textbook export saying "hematologic" instead
// of this app's "hematological").
const SYSTEM_ALIASES = {
  hematologic: 'hematological',
  integumentary: 'dermatological',
  renal_urinary: 'renal',
  urinary: 'renal',
  ent: 'sensory',
  ophthalmologic: 'sensory',
  ophthalmic: 'sensory',
  cardiac: 'cardiovascular',
  gi: 'gastrointestinal',
  neuro: 'neurological',
  psych: 'psychiatric',
  derm: 'dermatological',
  heme: 'hematological',
  gu: 'renal',
};

// "oncologic", "immunologic", and "general_surgical" have no dedicated
// system in this app — nursing texts group cancers/immune conditions by
// specialty, this app groups by body system. Best-effort content match so
// most of these still land somewhere sensible; anything unmatched falls
// back to a manual per-row dropdown instead of a wrong guess.
const LABEL_SYSTEM_HINTS = [
  [/bladder|kidney|renal/i, 'renal'],
  [/breast|cervix|endometri|ovary|prostate|testis|vagina|vulva/i, 'reproductive'],
  [/colon|rectum|colorectal|esophagus|liver|stomach|gastric|oral cavity|pancrea/i, 'gastrointestinal'],
  [/larynx|pharynx/i, 'sensory'],
  [/lung|bronchogenic/i, 'respiratory'],
  [/\bskin\b|melanoma/i, 'dermatological'],
  [/thyroid/i, 'endocrine'],
  [/hodgkin|kaposi|multiple myeloma/i, 'hematological'],
  [/\bhiv\b|septic/i, 'infectious'],
  [/lupus/i, 'musculoskeletal'],
];

const VALID_SYSTEM_IDS = new Set(ANATOMICAL_SYSTEMS.map(s => s.id));

function resolveSystemId(rawSystem, label) {
  const s = String(rawSystem || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (VALID_SYSTEM_IDS.has(s)) return s;
  if (SYSTEM_ALIASES[s]) return SYSTEM_ALIASES[s];
  for (const [re, sys] of LABEL_SYSTEM_HINTS) {
    if (re.test(label)) return sys;
  }
  return null; // needs a manual pick
}

function BulkAddConditionsCsv({ systemId, systemName, existingLabels }) {
  const { isAdmin } = useAuth();
  const { customConditionsBySystem } = useCustomConditions();

  const [rows, setRows] = useState([]);      // parsed + validated preview rows
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | done

  // Existing labels per resolved target system, for cross-system dedup
  // (the "current page" system uses the live existingLabels prop, which
  // already reflects any conditions added earlier in this session).
  const existingLabelSetFor = useMemo(() => {
    const cache = {};
    return (targetSystemId) => {
      if (!targetSystemId) return new Set();
      if (cache[targetSystemId]) return cache[targetSystemId];
      const labels = targetSystemId === systemId
        ? existingLabels
        : [...(SYSTEM_CONDITIONS[targetSystemId] || []), ...(customConditionsBySystem[targetSystemId] || [])].map(c => c.label);
      const set = new Set(labels.map(normalizeConditionLabel));
      cache[targetSystemId] = set;
      return set;
    };
  }, [systemId, existingLabels, customConditionsBySystem]);

  if (!isAdmin) return null; // only admins can bulk-curate the condition taxonomy

  const downloadTemplate = () => {
    const csv = Papa.unparse([
      { system: systemId, label: 'Hypertension', id: '', icon: '🩺', keywords: 'hypertension, high blood pressure' },
      { system: systemId, label: 'Example Condition', id: '', icon: '', keywords: '' },
    ]);
    downloadCSV(csv, `conditions_bulk_template.csv`);
  };

  const evaluateRow = (raw, idx, seenNorm, seenKey) => {
    const label = String(raw.label || '').trim();
    if (!label) {
      return { rowNum: idx + 2, label: raw.label || '', status: 'invalid', reason: 'Missing label' };
    }

    const targetSystemId = resolveSystemId(raw.system, label);
    const providedId = String(raw.id || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const id = providedId || slugifyConditionLabel(label);
    const normLabel = normalizeConditionLabel(label);
    const icon = String(raw.icon || '').trim() || '🩺';
    const keywordsRaw = String(raw.keywords || '').trim();
    const keywords = keywordsRaw
      ? Array.from(new Set(keywordsRaw.split(/[,|]/).map(k => k.trim().toLowerCase()).filter(Boolean)))
      : deriveKeywordsFromLabel(label);

    const dedupeKey = `${targetSystemId || '?'}::${normLabel}`;
    let status = 'new';
    let reason = '';
    if (!targetSystemId) {
      status = 'needs_system';
      reason = `Unrecognized system "${raw.system || ''}" — pick one`;
    } else if (existingLabelSetFor(targetSystemId).has(normLabel)) {
      status = 'duplicate';
      reason = 'Already exists in that system';
    } else if (seenNorm.has(dedupeKey) || seenKey.has(`${targetSystemId}::${id}`)) {
      status = 'duplicate';
      reason = 'Duplicate row in this file';
    }
    seenNorm.add(dedupeKey);
    if (targetSystemId) seenKey.add(`${targetSystemId}::${id}`);

    return { rowNum: idx + 2, id, label, icon, keywords, targetSystemId, rawSystem: raw.system, status, reason };
  };

  const revalidateRows = (builtRows) => {
    // Re-run dedup across the whole set after a manual system pick, so a
    // row that now collides with another (or with an existing condition)
    // gets flagged instead of silently double-added.
    const seenNorm = new Set();
    const seenKey = new Set();
    return builtRows.map((r, idx) => {
      if (r.status === 'invalid') return r;
      const normLabel = normalizeConditionLabel(r.label);
      const dedupeKey = `${r.targetSystemId || '?'}::${normLabel}`;
      let status = 'new';
      let reason = '';
      if (!r.targetSystemId) {
        status = 'needs_system';
        reason = `Unrecognized system "${r.rawSystem || ''}" — pick one`;
      } else if (existingLabelSetFor(r.targetSystemId).has(normLabel)) {
        status = 'duplicate';
        reason = 'Already exists in that system';
      } else if (seenNorm.has(dedupeKey) || seenKey.has(`${r.targetSystemId}::${r.id}`)) {
        status = 'duplicate';
        reason = 'Duplicate row in this file';
      }
      seenNorm.add(dedupeKey);
      if (r.targetSystemId) seenKey.add(`${r.targetSystemId}::${r.id}`);
      return { ...r, status, reason };
    });
  };

  const handleFile = (file) => {
    setFileName(file.name);
    setParseError('');
    setSaveError('');
    setSaveState('idle');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const fields = results.meta.fields || [];
        if (!fields.includes('label')) {
          setParseError('CSV must include a "label" column (system, id, icon, keywords are optional).');
          setRows([]);
          return;
        }
        const seenNorm = new Set();
        const seenKey = new Set();
        const built = results.data.map((raw, idx) => evaluateRow(raw, idx, seenNorm, seenKey));
        setRows(built);
      },
      error: (err) => {
        setParseError(err.message || 'Failed to parse CSV file.');
        setRows([]);
      },
    });
  };

  const handlePickSystem = (rowIdx, newSystemId) => {
    setRows(prev => revalidateRows(
      prev.map((r, i) => i === rowIdx ? { ...r, targetSystemId: newSystemId || null } : r)
    ));
  };

  const newRows = rows.filter(r => r.status === 'new');
  const needsSystemCount = rows.filter(r => r.status === 'needs_system').length;

  const handleSaveAll = async () => {
    if (newRows.length === 0) return;
    setSaveState('saving');
    setSaveError('');
    try {
      // Group by target system since addCustomConditions saves one system at a time.
      const bySystem = new Map();
      for (const r of newRows) {
        if (!bySystem.has(r.targetSystemId)) bySystem.set(r.targetSystemId, []);
        bySystem.get(r.targetSystemId).push({ id: r.id, label: r.label, icon: r.icon, keywords: r.keywords });
      }
      for (const [sysId, items] of bySystem.entries()) {
        await addCustomConditions(sysId, items);
      }
      setSaveState('done');
      // No AI auto-fill here — drugs and clinical info are added manually
      // afterward, so this just creates the empty condition cards.
    } catch (e) {
      setSaveError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
      setSaveState('idle');
    }
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setParseError('');
    setSaveError('');
    setSaveState('idle');
  };

  return (
    <div className="mt-4 bg-white border border-drug-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 bg-blue-50 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Upload className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span className="font-bold text-drug-text truncate">Bulk add conditions from CSV</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            <Download className="w-3.5 h-3.5" /> Template CSV
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Choose CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
            />
          </label>
        </div>
      </div>

      <div className="px-5 py-2 text-xs text-drug-muted bg-blue-50/50 border-t border-blue-100">
        Columns: <strong>label</strong> (required), <strong>system</strong>, <strong>id</strong>, <strong>icon</strong>,{' '}
        <strong>keywords</strong> (all optional). Rows can target any system, not just this one — conditions are
        routed to the system named in each row. Rows already existing, repeated in the file, or naming a system this
        app doesn't recognize are flagged so nothing gets silently duplicated or mis-filed.
      </div>

      {parseError && (
        <div className="p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{parseError}</p>
        </div>
      )}

      {fileName && !parseError && rows.length > 0 && (
        saveState === 'done' ? (
          <div className="p-5 text-center text-sm text-green-700 bg-green-50">
            ✓ Added {newRows.length} condition{newRows.length === 1 ? '' : 's'} from {fileName} — refreshing to show the new cards…
          </div>
        ) : (
          <div>
            {saveError && (
              <div style={{
                margin: '12px 16px',
                padding: '14px 16px',
                background: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: '#991B1B',
                lineHeight: 1.5,
              }}>
                ⚠️ {saveError}
              </div>
            )}
            {needsSystemCount > 0 && (
              <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                {needsSystemCount} row{needsSystemCount === 1 ? '' : 's'} need a system picked before they can be added.
              </div>
            )}
            <div className="max-h-96 overflow-y-auto">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-5 py-2.5 ${i !== rows.length - 1 ? 'border-b border-drug-border' : ''}`}
                >
                  <span className="text-xs text-drug-muted w-8 flex-shrink-0">#{r.rowNum}</span>
                  <span className="text-lg flex-shrink-0">{r.icon || '—'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.label || '(missing label)'}</div>
                    {r.keywords && (
                      <div className="text-xs text-drug-muted truncate">{r.keywords.slice(0, 4).join(', ')}</div>
                    )}
                  </div>
                  {r.status === 'needs_system' ? (
                    <select
                      value={r.targetSystemId || ''}
                      onChange={(e) => handlePickSystem(i, e.target.value)}
                      className="text-xs border border-amber-300 rounded-lg px-2 py-1 bg-white flex-shrink-0"
                    >
                      <option value="">Pick system…</option>
                      {ANATOMICAL_SYSTEMS.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {r.status === 'new' && (
                        <span className="text-xs font-bold text-green-600 flex-shrink-0">
                          New{r.targetSystemId !== systemId ? ` → ${getSystemById(r.targetSystemId)?.name || r.targetSystemId}` : ''}
                        </span>
                      )}
                      {r.status === 'duplicate' && (
                        <span className="text-xs font-semibold text-drug-muted flex-shrink-0" title={r.reason}>Skipped: {r.reason}</span>
                      )}
                      {r.status === 'invalid' && (
                        <span className="text-xs font-semibold text-red-500 flex-shrink-0" title={r.reason}>{r.reason}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-drug-bg/50 border-t border-drug-border">
              <button
                onClick={handleSaveAll}
                disabled={newRows.length === 0 || saveState === 'saving'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
              >
                <Save className="w-3.5 h-3.5" />
                {saveState === 'saving' ? 'Saving…' : `Add ${newRows.length} new condition${newRows.length === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={reset}
                className="text-xs font-semibold text-drug-muted hover:text-drug-text"
              >
                Clear
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function SystemPage() {
  const { systemId }  = useParams();
  const navigate      = useNavigate();
  const { isAdmin }   = useAuth();
  const { provider }  = useAiProvider();
  const { enqueueAutoFillCondition } = useAiInsight();
  const { drugs: ALL_DRUGS, loading, invalidateCache } = useDrugs();
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem } = useCustomConditions();
  const { clinicalInfoByCondition } = useConditionClinicalInfo();
  // Track drug↔condition links the admin just removed, so they disappear
  // immediately without waiting for a Firestore refetch. Keyed "drugId::condId".
  const [removedLinks, setRemovedLinks] = useState(() => new Set());
  const handleDrugRemoved = (drugId, condId) => {
    setRemovedLinks(prev => new Set(prev).add(`${drugId}::${condId}`));
    invalidateCache();
  };
  const [deletingConditionId, setDeletingConditionId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const handleDeleteCondition = async (condition) => {
    if (!window.confirm(`Delete "${condition.label}"? This removes the condition card and unlinks its drugs. This cannot be undone.`)) return;
    setDeletingConditionId(condition.id);
    setDeleteError('');
    try {
      await removeCondition(systemId, condition.id);
      // No manual state update needed — the live useCustomConditions()
      // listener picks up the Firestore change and re-renders automatically.
    } catch (err) {
      setDeleteError(`DELETE FAILED: ${err.code ? `[${err.code}] ` : ''}${err.message || 'Unknown error'}`);
    } finally {
      setDeletingConditionId(null);
    }
  };
  const [renamingConditionId, setRenamingConditionId] = useState(null);
  const [renameError, setRenameError] = useState('');
  const handleRenameCondition = async (condition, newLabel) => {
    if (newLabel.trim() === condition.label.trim()) return; // no-op
    setRenamingConditionId(condition.id);
    setRenameError('');
    try {
      await renameCondition(systemId, condition.id, newLabel);
      // Live listener picks up the change and re-renders automatically.
    } catch (err) {
      setRenameError(`RENAME FAILED: ${err.code ? `[${err.code}] ` : ''}${err.message || 'Unknown error'}`);
      throw err; // let the inline editor keep its edit state open on failure
    } finally {
      setRenamingConditionId(null);
    }
  };

  // ── Merge duplicate conditions ──────────────────────────────────────────
  // Admin picks 2+ condition cards that represent the same clinical entity
  // (e.g. "Aortic Aneurysm" / "Aneurysm, Aortic"), chooses which one to keep,
  // and every drug + any saved clinical info from the others is folded into
  // it before the duplicates are removed from the taxonomy.
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState(() => new Set());
  const [primaryMergeId, setPrimaryMergeId] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeResult, setMergeResult] = useState(null);

  const toggleMergeMode = () => {
    setMergeMode(m => !m);
    setSelectedForMerge(new Set());
    setPrimaryMergeId(null);
    setMergeError('');
    setMergeResult(null);
  };

  const handleToggleMergeSelect = (condition) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(condition.id)) {
        next.delete(condition.id);
        if (primaryMergeId === condition.id) setPrimaryMergeId(null);
      } else {
        next.add(condition.id);
      }
      return next;
    });
  };

  const handleConfirmMerge = async () => {
    if (!primaryMergeId || selectedForMerge.size < 2) return;
    const duplicateIds = [...selectedForMerge].filter(id => id !== primaryMergeId);
    const primaryCondition = [...conditionGroups.values()].find(e => e.condition.id === primaryMergeId)?.condition;
    const dupLabels = [...conditionGroups.values()]
      .filter(e => duplicateIds.includes(e.condition.id))
      .map(e => e.condition.label);
    if (!window.confirm(
      `Merge ${dupLabels.map(l => `"${l}"`).join(', ')} into "${primaryCondition?.label}"?\n\n` +
      `Every drug tagged under the merged-away conditions will be re-tagged to the kept one, and the merged-away condition cards will be removed. This cannot be undone.`
    )) return;

    setMerging(true);
    setMergeError('');
    try {
      const result = await mergeConditions(systemId, primaryMergeId, duplicateIds, ALL_DRUGS);
      setMergeResult({ ...result, primaryLabel: primaryCondition?.label });
      setSelectedForMerge(new Set());
      setPrimaryMergeId(null);
      setMergeMode(false);
    } catch (err) {
      setMergeError(`MERGE FAILED: ${err.code ? `[${err.code}] ` : ''}${err.message || 'Unknown error'}`);
    } finally {
      setMerging(false);
    }
  };
  const [viewMode,    setViewMode]    = useState('list');
  const [classFilter, setClassFilter] = useState('');
  const [nameSearch,  setNameSearch]  = useState('');
  // Only one condition accordion open at a time; none open by default.
  const [openConditionId, setOpenConditionId] = useState(null);

  const system = getSystemById(systemId);

  // AI-suggested, admin-approved conditions for this system (from Firestore),
  // merged with the static systemConditions.js list.
  const extraConditions = useMemo(
    () => customConditionsBySystem[systemId] || [],
    [customConditionsBySystem, systemId]
  );
  const hiddenIds = useMemo(
    () => hiddenConditionIdsBySystem[systemId] || [],
    [hiddenConditionIdsBySystem, systemId]
  );
  const labelOverrides = useMemo(
    () => labelOverridesBySystem[systemId] || {},
    [labelOverridesBySystem, systemId]
  );

  // All drugs in this system. A drug qualifies either by its drug_class
  // matching the system's own class keywords (e.g. NSAID → Musculoskeletal),
  // OR by matching one of this system's specific conditions by indication
  // text — even if its class alone wouldn't (e.g. an antibiotic generated
  // for "Osteomyelitis" under Musculoskeletal). Without this, drugs the AI
  // correctly generates for a condition could vanish from that condition's
  // card simply because their drug class isn't one of the system's own.
  const drugs = useMemo(() => {
    if (!system) return [];
    const byClass = getDrugsForSystem(ALL_DRUGS, system);
    const byClassIds = new Set(byClass.map(d => d.id));
    const byCondition = ALL_DRUGS.filter(d =>
      !byClassIds.has(d.id) && getDrugConditions(d, systemId, extraConditions).length > 0
    );
    return [...byClass, ...byCondition].sort((a, b) =>
      (a.generic_name || '').localeCompare(b.generic_name || '')
    );
  }, [ALL_DRUGS, system, systemId, extraConditions]);

  // Group by condition
  const conditionGroups = useMemo(
    () => groupDrugsByCondition(drugs, systemId, extraConditions, hiddenIds, labelOverrides),
    [drugs, systemId, extraConditions, hiddenIds, labelOverrides]
  );

  const [retryingEmpty, setRetryingEmpty] = useState(false);

  // Shared by the automatic on-visit sweep below AND the manual "Retry"
  // button (admin-only) — resetFirst clears this system's entries from the
  // attempted-flag doc before sweeping, so conditions that were queued but
  // never actually got processed (e.g. the queue race that existed before
  // this fix, or any other silent failure) can be re-attempted on demand
  // instead of being permanently skipped.
  const runEmptyConditionSweep = async ({ resetFirst = false } = {}) => {
    const emptyConditions = [...conditionGroups.entries()]
      .filter(([, g]) => g.drugs.length === 0)
      .map(([id, g]) => ({ id, label: g.condition.label, keywords: g.condition.keywords }));
    if (emptyConditions.length === 0) return 0;

    const flagRef = doc(db, 'app_config', 'condition_autofill_attempted');
    const snap = await getDoc(flagRef);
    let attemptedIds = snap.exists() ? (snap.data().ids || []) : [];

    if (resetFirst) {
      const prefix = `${systemId}::`;
      attemptedIds = attemptedIds.filter(id => !id.startsWith(prefix));
      await setDoc(flagRef, { ids: attemptedIds }, { merge: true });
    }

    const attempted = new Set(attemptedIds);
    const toQueue = emptyConditions.filter(c => !attempted.has(`${systemId}::${c.id}`));
    if (toQueue.length === 0) return 0;

    await setDoc(flagRef, {
      ids: arrayUnion(...toQueue.map(c => `${systemId}::${c.id}`)),
    }, { merge: true });

    toQueue.forEach(c => enqueueAutoFillCondition({
      conditionId: c.id, label: c.label, conditionKeywords: c.keywords, systemName: system.name, endpoint: provider.endpoint,
    }));
    return toQueue.length;
  };

  async function handleRetryEmptyConditions() {
    setRetryingEmpty(true);
    try {
      await runEmptyConditionSweep({ resetFirst: true });
    } catch (e) {
      console.warn('[retry empty conditions] failed:', e.message);
    } finally {
      setRetryingEmpty(false);
    }
  }

  // ── Bulk clinical-info generation: fills in the Introduction/Types/
  // Organ System/Etiology/Pathophysiology/Clinical Manifestation/Diagnosis/
  // Medical Management panel for every condition in this system that
  // doesn't have one yet. Runs sequentially (not queued into the global
  // AiInsightContext job system, since this is scoped to whichever system
  // page is open) with a small pacing delay between calls, matching the
  // other bulk AI loops in this app.
  const [clinicalSweep, setClinicalSweep] = useState({ running: false, done: 0, total: 0, errors: 0 });

  const missingClinicalInfoCount = useMemo(
    () => [...conditionGroups.values()].filter(e => !clinicalInfoByCondition[e.condition.id]).length,
    [conditionGroups, clinicalInfoByCondition]
  );

  async function handleGenerateAllClinicalInfo() {
    if (clinicalSweep.running) return;
    const missing = [...conditionGroups.values()]
      .map(e => e.condition)
      .filter(c => !clinicalInfoByCondition[c.id]);
    if (missing.length === 0) return;

    setClinicalSweep({ running: true, done: 0, total: missing.length, errors: 0 });
    for (const c of missing) {
      let failed = false;
      try {
        const full = await fetchConditionClinicalInfo({ conditionLabel: c.label, systemName: system.name, endpoint: provider.endpoint });
        const parsed = parseConditionClinicalInfo(full);
        await saveConditionClinicalInfo(c.id, parsed);
      } catch (e) {
        failed = true;
        console.warn('[clinical info sweep] failed for', c.label, e.message);
      }
      setClinicalSweep(s => ({ ...s, done: s.done + 1, errors: s.errors + (failed ? 1 : 0) }));
      await new Promise(r => setTimeout(r, 350));
    }
    setClinicalSweep(s => ({ ...s, running: false }));
  }

  // ── Auto-fill sweep: any condition in THIS system that currently has zero
  // tagged drugs gets queued for AI auto-fill automatically — no admin click
  // needed. Each condition is only ever auto-attempted once (tracked in
  // Firestore via a flag doc), so this doesn't re-run every time the system
  // page is visited, and doesn't repeatedly burn AI quota retrying a
  // condition that legitimately turned up nothing.
  useEffect(() => {
    if (!isAdmin || loading || !system) return;
    let cancelled = false;

    (async () => {
      try {
        if (cancelled) return;
        await runEmptyConditionSweep();
      } catch (e) {
        console.warn('[empty-condition auto-fill sweep] failed:', e.message);
      }
    })();

    return () => { cancelled = true; };
    // Deliberately only re-runs when the system or loading state changes —
    // NOT on every conditionGroups recompute, which would re-fire while the
    // very auto-fill run this triggers is still in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loading, systemId]);

  // All drug classes across this system (for dropdown)
  const allClasses = useMemo(() => {
    const s = new Set(drugs.map(d => d.drug_class).filter(Boolean));
    return [...s].sort();
  }, [drugs]);

  // Condition ids whose own label matches the current search text — drugs
  // tagged to one of these count as visible even if their own name/class
  // doesn't contain the search text.
  const matchingConditionIds = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return new Set();
    return new Set(
      [...conditionGroups.values()]
        .filter(e => e.condition.label?.toLowerCase().includes(q))
        .map(e => e.condition.id)
    );
  }, [conditionGroups, nameSearch]);

  // Total visible after filters
  const visibleCount = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      if (!matchClass) return false;
      if (!q) return true;
      const matchName =
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      if (matchName) return true;
      const tags = Array.isArray(d.condition_tags) ? d.condition_tags : [];
      return tags.some(id => matchingConditionIds.has(id));
    }).length;
  }, [drugs, classFilter, nameSearch, matchingConditionIds]);

  // Same field set as the main Bulk Upload template (UploadPage.js), plus
  // condition_tags so drugs land under the right condition on this System
  // page as soon as they're uploaded.
  const DRUG_CSV_HEADERS = [
    'generic_name','drug_class','drug_subclass','prescription_status','nafdac_no',
    'overview','strength','indications','therapeutic_note',
    'adult_dose','child_dose','renal_dose','administration','nstg_recommendations',
    'pharmacology','advice_to_patients','contraindications','precautions',
    'pregnancy_lactation','interaction','adverse_effect','nursing_action',
    'pharmacovigilance','product_description','storage_recommendations','pack_size_price',
    'source','status','condition_tags',
  ];

  function downloadSystemTemplate() {
    // One pre-filled row per condition already known for this system, with
    // condition_tags set to that condition's id — everything else left blank
    // for Dee to fill in per drug. Rows can be duplicated in Excel/Sheets for
    // multiple drugs under the same condition.
    const conditions = [...conditionGroups.values()].map(e => e.condition);
    const rows = conditions.length > 0
      ? conditions.map(cond => {
          const row = DRUG_CSV_HEADERS.reduce((acc, h) => ({ ...acc, [h]: '' }), {});
          row.condition_tags = cond.id;
          row.status = 'Active';
          row.source = 'CSV Upload';
          return row;
        })
      : [DRUG_CSV_HEADERS.reduce((acc, h) => ({ ...acc, [h]: '' }), {})];

    const csv = Papa.unparse(rows, { columns: DRUG_CSV_HEADERS });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeName = system.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    link.download = `${safeName}_bulk_upload_template.csv`;
    link.click();
  }

  if (!system) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-drug-muted mb-4">Unknown system.</p>
        <Link to="/systems" className="text-primary-600 font-semibold hover:underline">
          Browse all systems
        </Link>
      </div>
    );
  }

  const Icon = ICONS[system.icon] || Pill;

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden ${mergeMode ? 'pb-40' : ''}`}>
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* System header */}
      <div className="flex items-start gap-4 mb-3">
        <div className={`p-3 rounded-xl ${system.bg} flex-shrink-0`}>
          <Icon className={`w-7 h-7 ${system.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{system.name}</h1>
          <p className="text-drug-muted mt-0.5 text-sm">
            {loading ? 'Loading…' : `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} · ${conditionGroups.size} condition${conditionGroups.size !== 1 ? 's' : ''} · ${allClasses.length} drug class${allClasses.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
      </div>

      {isAdmin && !loading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
          <button
            onClick={handleRetryEmptyConditions}
            disabled={retryingEmpty}
            title="Re-queue any conditions in this system that still have zero drugs — useful if an earlier auto-fill run stalled partway through"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retryingEmpty ? 'animate-spin' : ''}`} />
            {retryingEmpty ? 'Retrying…' : 'Retry empty conditions'}
          </button>
          {(missingClinicalInfoCount > 0 || clinicalSweep.running) && (
            <button
              onClick={handleGenerateAllClinicalInfo}
              disabled={clinicalSweep.running}
              title="Generate the clinical info panel (introduction, types, organ system, etiology, pathophysiology, clinical manifestation, diagnosis, and management) for every condition here that doesn't have one yet"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {clinicalSweep.running
                ? `Adding Clinical Info ${clinicalSweep.done}/${clinicalSweep.total}…`
                : `Add Clinical Info to All (${missingClinicalInfoCount})`}
            </button>
          )}
          <button
            onClick={toggleMergeMode}
            title="Select two or more condition cards that represent the same clinical entity and fold them into one"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 ${
              mergeMode ? 'text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg' : 'text-amber-600 hover:text-amber-800'
            }`}
          >
            <Merge className="w-3.5 h-3.5" />
            {mergeMode ? 'Cancel Merge' : 'Merge Duplicates'}
          </button>
        </div>
      )}

      {/* Floating merge-mode toggle — fixed to the bottom of the screen so it
          stays reachable while scrolling through a long condition list,
          instead of only being available in the button row up top. Hidden
          once merge mode is active since the fixed selection/confirm bar
          (further down) takes over that space and has its own Cancel. */}
      {isAdmin && !loading && !mergeMode && (
        <button
          onClick={toggleMergeMode}
          title="Select two or more condition cards that represent the same clinical entity and fold them into one"
          className="fixed right-4 z-40 inline-flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-amber-600 text-white text-sm font-semibold shadow-lg hover:bg-amber-700"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <Merge className="w-4 h-4" />
          Merge Duplicates
        </button>
      )}

      {!clinicalSweep.running && clinicalSweep.total > 0 && clinicalSweep.errors > 0 && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          ⚠ Clinical info: {clinicalSweep.total - clinicalSweep.errors} of {clinicalSweep.total} generated successfully, {clinicalSweep.errors} failed — click "Add Clinical Info to All" again to retry the rest.
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            placeholder="Search within this system…"
            className="w-full pl-4 pr-4 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="py-2 px-3 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="">All Drug Classes ({allClasses.length})</option>
          {allClasses.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        <button onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <List className="w-5 h-5" />
        </button>
        <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <Grid3X3 className="w-5 h-5" />
        </button>

        {isAdmin && (
          <button
            onClick={downloadSystemTemplate}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            title="Download a CSV pre-filled with this system's conditions, ready for Bulk Upload"
          >
            <Download className="w-4 h-4" /> Download CSV Template
          </button>
        )}
      </div>

      {/* Filter summary */}
      {(classFilter || nameSearch) && (
        <div className="flex items-center gap-3 mb-4 text-sm text-drug-muted">
          <span>
            Showing <strong className="text-drug-text">{visibleCount}</strong> of {drugs.length} drugs
          </span>
          <button
            onClick={() => { setClassFilter(''); setNameSearch(''); }}
            className="text-red-500 font-semibold hover:text-red-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-drug-muted">Loading…</div>
      ) : (
        <>
          {drugs.length === 0 ? (
            <div className="bg-white border border-drug-border rounded-xl p-10 text-center">
              <Icon className={`w-10 h-10 mx-auto mb-3 ${system.color}`} />
              <p className="text-drug-muted">No medications matched to {system.name} yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...conditionGroups.values()]
                .filter((entry) => {
                  const q = nameSearch.trim().toLowerCase();
                  if (!q) return true;
                  if (entry.condition.label?.toLowerCase().includes(q)) return true;
                  return entry.drugs.some(d => {
                    const matchClass = !classFilter || d.drug_class === classFilter;
                    if (!matchClass) return false;
                    return d.generic_name?.toLowerCase().includes(q) ||
                      d.drug_subclass?.toLowerCase().includes(q) ||
                      d.drug_class?.toLowerCase().includes(q);
                  });
                })
                .map((entry) => (
                <ConditionSection
                  key={entry.condition.id}
                  condition={entry.condition}
                  drugs={entry.drugs.filter(d => !removedLinks.has(`${d.id}::${entry.condition.id}`))}
                  viewMode={viewMode}
                  classFilter={classFilter}
                  nameSearch={nameSearch}
                  isOpen={openConditionId === entry.condition.id}
                  onToggle={() => setOpenConditionId(o => o === entry.condition.id ? null : entry.condition.id)}
                  systemName={system.name}
                  systemId={systemId}
                  onDrugRemoved={handleDrugRemoved}
                  clinicalInfo={clinicalInfoByCondition[entry.condition.id]}
                  onDeleteCondition={handleDeleteCondition}
                  isDeleting={deletingConditionId === entry.condition.id}
                  onRenameCondition={handleRenameCondition}
                  isRenaming={renamingConditionId === entry.condition.id}
                  mergeMode={mergeMode}
                  isSelectedForMerge={selectedForMerge.has(entry.condition.id)}
                  onToggleMergeSelect={handleToggleMergeSelect}
                />
              ))}
            </div>
          )}
          {deleteError && (
            <p className="mt-3 text-xs text-red-600 font-medium">{deleteError}</p>
          )}
          {renameError && (
            <p className="mt-3 text-xs text-red-600 font-medium">{renameError}</p>
          )}

          {mergeMode && (
            <div className="fixed left-0 right-0 bottom-0 z-40 px-4 sm:px-6 lg:px-8 pb-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="max-w-7xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-lg">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Merge mode</span>
                  <button
                    onClick={toggleMergeMode}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
                {selectedForMerge.size === 0 && (
                  <p className="text-sm text-amber-800">
                    Tap two or more condition cards above that represent the same clinical entity.
                  </p>
                )}
                {selectedForMerge.size === 1 && (
                  <p className="text-sm text-amber-800">
                    Select at least one more card to merge with — 1 selected so far.
                  </p>
                )}
                {selectedForMerge.size >= 2 && (
                  <>
                    <p className="text-sm font-semibold text-amber-900 mb-2">
                      {selectedForMerge.size} selected — choose which one to keep:
                    </p>
                    <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                      {[...conditionGroups.values()]
                        .filter(e => selectedForMerge.has(e.condition.id))
                        .map(e => (
                          <label key={e.condition.id} className="flex items-center gap-2 text-sm text-drug-text cursor-pointer">
                            <input
                              type="radio"
                              name="merge-primary"
                              checked={primaryMergeId === e.condition.id}
                              onChange={() => setPrimaryMergeId(e.condition.id)}
                            />
                            <span>{e.condition.icon} {e.condition.label}</span>
                            <span className="text-xs text-drug-muted">({e.drugs.length} drug{e.drugs.length !== 1 ? 's' : ''})</span>
                          </label>
                        ))}
                    </div>
                    <button
                      onClick={handleConfirmMerge}
                      disabled={!primaryMergeId || merging}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
                    >
                      <Merge className="w-3.5 h-3.5" />
                      {merging ? 'Merging…' : `Merge ${selectedForMerge.size - 1} into ${primaryMergeId ? [...conditionGroups.values()].find(e => e.condition.id === primaryMergeId)?.condition.label : 'selected'}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {mergeError && (
            <p className="mt-3 text-xs text-red-600 font-medium">{mergeError}</p>
          )}
          {mergeResult && !mergeMode && (
            <p className="mt-3 text-xs text-green-700 font-medium">
              ✓ Merged {mergeResult.conditionsRemoved} condition{mergeResult.conditionsRemoved !== 1 ? 's' : ''} into "{mergeResult.primaryLabel}" — {mergeResult.drugsUpdated} drug{mergeResult.drugsUpdated !== 1 ? 's' : ''} re-tagged.
            </p>
          )}

          <AiSystemConditionsFallback
            systemId={systemId}
            systemName={system.name}
            existingLabels={[...conditionGroups.values()].map(e => e.condition.label)}
          />

          <BulkAddConditionsCsv
            systemId={systemId}
            systemName={system.name}
            existingLabels={[...conditionGroups.values()].map(e => e.condition.label)}
          />
        </>
      )}

      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        Drugs are grouped by the clinical conditions they treat within the {system.name} system.
        A drug treating multiple conditions (e.g. a beta-blocker used in both Hypertension and Heart Failure)
        appears under each relevant group.
      </div>
    </div>
  );
}
