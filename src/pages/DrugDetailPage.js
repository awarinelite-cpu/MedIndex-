import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Pill, AlertTriangle, Heart, Baby, Clock,
  FlaskConical, ChevronLeft, Stethoscope, ClipboardList, Check, X, Plus,
  Sparkles, RefreshCw, Save,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugDetail } from '../utils/parseAiDrugDetail';
import { needsStrengthOnly } from '../utils/aiDrugSave';
import {
  collection, getDocs, doc, updateDoc, addDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Route badges ─────────────────────────────────────────────────────────────
const ROUTE_META = {
  'PO':  { label: 'Oral (PO)',          color: '#1D4ED8', bg: '#EFF6FF' },
  'IV':  { label: 'Intravenous (IV)',   color: '#065F46', bg: '#ECFDF5' },
  'IM':  { label: 'Intramuscular (IM)', color: '#7C3AED', bg: '#F5F3FF' },
  'SC':  { label: 'Subcutaneous (SC)',  color: '#B45309', bg: '#FFFBEB' },
  'SL':  { label: 'Sublingual (SL)',    color: '#BE185D', bg: '#FDF2F8' },
  'PR':  { label: 'Rectal (PR)',        color: '#C2410C', bg: '#FFF7ED' },
  'INH': { label: 'Inhaled (INH)',      color: '#0E7490', bg: '#ECFEFF' },
  'TOP': { label: 'Topical (TOP)',      color: '#166534', bg: '#F0FDF4' },
  'NAS': { label: 'Nasal (NAS)',        color: '#1E40AF', bg: '#EFF6FF' },
  'TD':  { label: 'Transdermal (TD)',   color: '#92400E', bg: '#FFFBEB' },
};

// Detect which routes appear in dosage text
function detectRoutes(doseTexts) {
  // doseTexts can be a single string or an array of strings (adult/child/renal combined)
  const combined = Array.isArray(doseTexts) ? doseTexts.filter(Boolean).join(' \n ') : doseTexts;
  if (!combined) return [];
  const found = [];
  // Check for route abbreviations as whole words
  const text = combined.toUpperCase();
  Object.keys(ROUTE_META).forEach(r => {
    // Match PO, IV etc. as word boundaries
    const re = new RegExp(`\\b${r}\\b`);
    if (re.test(text)) found.push(r);
  });
  // Also detect "buccal", "rectal", "oral", "sublingual" written out
  if (/\boral\b/i.test(combined) && !found.includes('PO'))   found.push('PO');
  if (/\brectal\b/i.test(combined) && !found.includes('PR')) found.push('PR');
  if (/\bbuccal\b/i.test(combined))                          found.push('SL'); // treat buccal like SL display
  if (/\binhale|inhal|nebul/i.test(combined) && !found.includes('INH')) found.push('INH');
  if (/\btopical|transdermal\b/i.test(combined) && !found.includes('TOP')) found.push('TOP');
  if (/\bsubcutan|SC\b/i.test(combined) && !found.includes('SC')) found.push('SC');
  return [...new Set(found)];
}

// Render dosage text with route abbreviations highlighted inline
function renderDosageWithRoutes(text) {
  if (!text) return <em className="text-drug-muted">No data available</em>;

  // Split on newlines or pipe for sections
  const sections = text.split(/\n|\|/).map(s => s.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {sections.map((section, i) => {
        // Highlight route abbreviations within the text
        const parts = section.split(/\b(PO|IV|IM|SC|SL|PR|INH|TOP|NAS|TD)\b/g);
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
            <p className="text-drug-text leading-relaxed">
              {parts.map((part, j) => {
                const meta = ROUTE_META[part];
                if (meta) {
                  return (
                    <span
                      key={j}
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: '0.8em',
                        fontWeight: 700,
                        margin: '0 2px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {part}
                    </span>
                  );
                }
                return part;
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function renderList(value, separator = '|') {
  if (!value) return <em className="text-drug-muted">No data available</em>;
  const items = value.split(separator).map(s => s.trim()).filter(Boolean);
  if (items.length <= 1) {
    return <p className="text-drug-text leading-relaxed">{value}</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-drug-text">
          <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function renderCSV(value) {
  if (!value) return <em className="text-drug-muted">No data available</em>;
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
          {item}
        </span>
      ))}
    </div>
  );
}

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: Pill          },
  { id: 'dosage',       label: 'Dosage',        icon: Clock         },
  { id: 'safety',       label: 'Safety',        icon: AlertTriangle },
  { id: 'interactions', label: 'Interactions',  icon: FlaskConical  },
  { id: 'pharmacology', label: 'Pharmacology',  icon: Heart         },
  { id: 'nursing',      label: 'Nursing Notes', icon: Stethoscope   },
  { id: 'ai-insights',  label: 'AI Insights',   icon: Sparkles      },
];

/* ── AI Insights Tab ─────────────────────────────────────────────────────── */
function AiInsightsTab({ drug }) {
  const { isAdmin }    = useAuth();
  // If already saved to Firestore, show immediately — no need to regenerate
  const [state, setState]       = useState(drug.ai_insights ? 'done' : 'idle');
  const [text, setText]         = useState(drug.ai_insights || '');
  const [error, setError]       = useState('');
  const [saveState, setSaveState] = useState(drug.ai_insights ? 'saved' : 'idle');
  // idle | saving | confirm | saved | error
  const [saveError, setSaveError] = useState('');

  // Fields the Overview/Dosage/Safety/etc. tabs actually read from.
  const STRUCTURED_FIELDS = [
    'overview', 'strength', 'indications', 'therapeutic_note', 'pharmacology',
    'adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations',
    'contraindications', 'precautions', 'pregnancy_lactation', 'interaction',
    'adverse_effect', 'advice_to_patients', 'nursing_action', 'pharmacovigilance',
    'product_description', 'storage_recommendations', 'pack_size_price',
  ];

  const writeToFirestore = async (parsedFields) => {
    await updateDoc(doc(db, 'drugs', drug.firestoreId || drug.id), {
      ...parsedFields,
      ai_insights:  text,
      last_updated: serverTimestamp(),
    });
  };

  const fetchInsights = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    try {
      const knownData = [
        drug.overview && `Overview: ${drug.overview}`,
        drug.strength && `Strength: ${drug.strength}`,
        drug.indications && `Indications: ${drug.indications}`,
        drug.therapeutic_note && `Therapeutic note: ${drug.therapeutic_note}`,
        drug.adult_dose && `Adult dose: ${drug.adult_dose}`,
        drug.child_dose && `Child dose: ${drug.child_dose}`,
        drug.renal_dose && `Renal dose: ${drug.renal_dose}`,
        drug.administration && `Administration: ${drug.administration}`,
        drug.nstg_recommendations && `NSTG recommendations: ${drug.nstg_recommendations}`,
        drug.pharmacology && `Pharmacology: ${drug.pharmacology}`,
        drug.advice_to_patients && `Advice to patients: ${drug.advice_to_patients}`,
        drug.contraindications && `Contraindications: ${drug.contraindications}`,
        drug.precautions && `Precautions: ${drug.precautions}`,
        drug.pregnancy_lactation && `Pregnancy/lactation: ${drug.pregnancy_lactation}`,
        drug.interaction && `Interactions: ${drug.interaction}`,
        drug.adverse_effect && `Known adverse effects: ${drug.adverse_effect}`,
        drug.nursing_action && `Nursing action: ${drug.nursing_action}`,
        drug.pharmacovigilance && `Pharmacovigilance: ${drug.pharmacovigilance}`,
        drug.product_description && `Product description: ${drug.product_description}`,
        drug.storage_recommendations && `Storage: ${drug.storage_recommendations}`,
        drug.pack_size_price && `Pack size/price: ${drug.pack_size_price}`,
        drug.nafdac_no && `NAFDAC no.: ${drug.nafdac_no}`,
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/drug-ai-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genericName: drug.generic_name,
          brandNames:  drug.brand_names || '',
          drugClass:   drug.drug_class  || '',
          knownData,
        }),
      });

      if (!res.ok || !res.body) {
        let message = 'Something went wrong.';
        try { message = (await res.json()).error || message; } catch {}
        throw new Error(message);
      }

      setState('streaming');
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI insights.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const parsedFields = parseAiDrugDetail(text);

      // Fast path: this drug already has every core field filled in and is
      // only missing strength — skip the confirm step and write just that
      // one field instead of the full record, so it's quick.
      if (needsStrengthOnly(drug) && parsedFields.strength) {
        await updateDoc(doc(db, 'drugs', drug.firestoreId || drug.id), {
          strength:     parsedFields.strength,
          last_updated: serverTimestamp(),
        });
        setSaveState('saved');
        setTimeout(() => window.location.reload(), 900);
        return;
      }

      // If any other structured field the tabs read from is already
      // populated on this drug, confirm before overwriting it rather than
      // silently replacing existing (possibly verified) data.
      const wouldOverwrite = STRUCTURED_FIELDS.some(
        f => f !== 'strength' && drug[f] && String(drug[f]).trim() && parsedFields[f]
      );

      if (wouldOverwrite) {
        setSaveState('confirm');
        return;
      }

      await writeToFirestore(parsedFields);
      setSaveState('saved');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setSaveError(e.message || 'Failed to save this drug.');
      setSaveState('error');
    }
  };

  const confirmOverwrite = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      const parsedFields = parseAiDrugDetail(text);
      await writeToFirestore(parsedFields);
      setSaveState('saved');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setSaveError(e.message || 'Failed to update this drug.');
      setSaveState('error');
    }
  };

  if (state === 'idle') {
    return (
      <div className="section-card p-8 text-center">
        <Sparkles className="w-10 h-10 text-primary-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-drug-text mb-2">Get Extensive AI Details</h2>
        <p className="text-sm text-drug-muted max-w-md mx-auto mb-5">
          Generate an in-depth clinical reference summary for {drug.generic_name} — mechanism of action,
          pharmacokinetics, special populations, interactions, monitoring, and nursing education points.
        </p>
        <button
          onClick={fetchInsights}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Generate AI Insights
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="section-card p-8 text-center">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Generating extensive details for {drug.generic_name}…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="section-card p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchInsights}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  // streaming or done
  return (
    <div className="section-card p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-bold text-drug-text">AI Clinical Insights</h2>
          {state === 'streaming' && (
            <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin" />
          )}
          {saveState === 'saved' && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              ✓ Saved — refreshing…
            </span>
          )}
        </div>

        {state === 'done' && (
          <div className="flex items-center gap-2">
            {/* Save button — updates Firestore so it loads instantly next visit */}
            {isAdmin && saveState !== 'saved' && saveState !== 'confirm' && (
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: saveState === 'error' ? '#FEF2F2' : '#1e40af',
                  color: saveState === 'error' ? '#DC2626' : '#fff',
                  border: saveState === 'error' ? '1px solid #FECACA' : 'none',
                  cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveState === 'saving' ? 0.7 : 1,
                }}
              >
                {saveState === 'saving' ? (
                  <><RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Saving…</>
                ) : saveState === 'error' ? (
                  <>⚠ {saveError || 'Save failed'} — Retry</>
                ) : (
                  <><Save style={{ width: 13, height: 13 }} /> Save to Database</>
                )}
              </button>
            )}

            <button
              onClick={fetchInsights}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {saveState === 'confirm' && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-amber-800 flex-1">
            This drug already has saved information in Overview, Dosage, or Safety. Update it with this
            new AI-generated version?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={confirmOverwrite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
            >
              <Check className="w-3.5 h-3.5" /> Update entry
            </button>
            <button
              onClick={() => setSaveState('idle')}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {text
        ? renderAiText(text)
        : <p className="text-sm text-drug-muted">Starting…</p>}

      {state === 'done' && (
        <div className="mt-6 pt-4 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
          AI-generated content is a reference aid, not a substitute for the current product monograph or clinical
          judgment. Verify against official prescribing information before applying to patient care.
        </div>
      )}
    </div>
  );
}

/* ── Add to List Button ──────────────────────────────────────────────────── */
function AddToListButton({ drug }) {
  const { user }           = useAuth();
  const [open, setOpen]    = useState(false);
  const [lists, setLists]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded]  = useState({});   // listId → true

  const loadLists = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'lists'), orderBy('createdAt', 'desc'))
      );
      setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error('Load lists for picker:', e); }
    setLoading(false);
  };

  const handleOpen = () => { setOpen(true); loadLists(); };

  const addToList = async (list) => {
    if (!user?.uid) return;
    const already = (list.drugs || []).some(d => d.drugId === drug.id);
    if (already) { setAdded(p => ({ ...p, [list.id]: true })); return; }
    try {
      const updatedDrugs = [
        ...(list.drugs || []),
        {
          drugId:    drug.id,
          drugName:  drug.generic_name,
          drugClass: drug.drug_class || '',
          notes:     '',
          addedAt:   serverTimestamp(),
        },
      ];
      await updateDoc(doc(db, 'users', user.uid, 'lists', list.id), {
        drugs: updatedDrugs,
        last_updated: serverTimestamp(),
      });
      setAdded(p => ({ ...p, [list.id]: true }));
    } catch (e) { console.error('Add to list error:', e); }
  };

  const createAndAdd = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'lists'), {
        title:     `New List`,
        createdAt: serverTimestamp(),
        drugs: [{
          drugId:    drug.id,
          drugName:  drug.generic_name,
          drugClass: drug.drug_class || '',
          notes:     '',
          addedAt:   serverTimestamp(),
        }],
      });
      setAdded(p => ({ ...p, [ref.id]: true }));
      await loadLists();
      setOpen(false);
    } catch (e) { console.error('Create list error:', e); }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary-300 bg-primary-50 text-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors"
      >
        <ClipboardList className="w-4 h-4" /> Add to List
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-12 z-50 bg-white border border-drug-border rounded-xl shadow-xl w-72 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-drug-border">
              <span className="font-semibold text-drug-text text-sm">Save to a list</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-drug-muted" />
              </button>
            </div>

            {loading && (
              <div className="px-4 py-6 text-center text-sm text-drug-muted">Loading lists…</div>
            )}

            {!loading && lists.length === 0 && (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-drug-muted mb-3">No lists yet</p>
                <button
                  onClick={(e) => { e.stopPropagation(); createAndAdd(); }}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" /> Create a List &amp; Add
                </button>
              </div>
            )}

            {!loading && lists.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y divide-drug-border">
                {lists.map(list => {
                  const isAdded = added[list.id] || (list.drugs || []).some(d => d.drugId === drug.id);
                  return (
                    <button
                      key={list.id}
                      onClick={() => addToList(list)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-drug-text">{list.title}</div>
                        <div className="text-xs text-drug-muted">{(list.drugs || []).length} drugs</div>
                      </div>
                      {isAdded
                        ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <Plus  className="w-4 h-4 text-drug-muted flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && lists.length > 0 && (
              <div className="border-t border-drug-border px-4 py-3">
                <button
                  onClick={createAndAdd}
                  className="flex items-center gap-2 text-sm text-primary-600 font-semibold hover:text-primary-800"
                >
                  <Plus className="w-4 h-4" /> New list with this drug
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DrugDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { drugs } = useDrugs();
  const drug = useMemo(() => drugs.find(d => d.id === id) || null, [drugs, id]);
  const [activeTab, setActiveTab] = useState('overview');


  if (!drug) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-600">Drug not found</h2>
        <p className="text-gray-500 mt-2">The medication "{id}" doesn't exist in our database.</p>
        <Link to="/browse" className="inline-block mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
          Browse all drugs
        </Link>
      </div>
    );
  }

  const isControlled = drug.prescription_status === 'Controlled';
  const detectedRoutes = detectRoutes([drug.adult_dose, drug.child_dose, drug.renal_dose]);

  // ── Special Populations click handlers ───────────────────────────────────
  const goToTab = (tab) => {
    setActiveTab(tab);
    // Scroll to top of tab content smoothly
    setTimeout(() => {
      const el = document.getElementById('drug-tab-content');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/browse'))}
          className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <AddToListButton drug={drug} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill className="w-7 h-7 text-primary-600" />
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
            drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                         'bg-blue-100 text-blue-700'
          }`}>
            {drug.prescription_status}
          </span>
          {isControlled && (
            <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Controlled Substance
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-drug-text">{drug.generic_name}</h1>
        <p className="text-lg text-primary-600 font-medium mt-1">
          <Link to={`/browse?class=${encodeURIComponent(drug.drug_class || '')}`} className="hover:underline">
            {drug.drug_class}
          </Link>
          {drug.drug_subclass && drug.drug_subclass !== drug.drug_class && (
            <>
              {' — '}
              <Link to={`/browse?class=${encodeURIComponent(drug.drug_subclass)}`} className="hover:underline">
                {drug.drug_subclass}
              </Link>
            </>
          )}
        </p>

        {/* Route of Administration + Strength badges — shown on header */}
        {(detectedRoutes.length > 0 || drug.strength) && (
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            {detectedRoutes.length > 0 && (
              <>
                <span className="text-xs text-drug-muted font-semibold uppercase tracking-wide self-center">Routes:</span>
                {detectedRoutes.map(r => {
                  const meta = ROUTE_META[r];
                  return (
                    <span
                      key={r}
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
                      className="text-xs font-bold px-3 py-1 rounded-full"
                    >
                      {meta.label}
                    </span>
                  );
                })}
              </>
            )}
            {drug.strength && drug.strength.split('\n').filter(Boolean).map((line, i) => (
              <span
                key={i}
                style={{ background: '#F5F3FF', color: '#6D28D9', border: '1px solid #6D28D930' }}
                className="text-xs font-bold px-3 py-1 rounded-full"
                title="Strength / formulation"
              >
                {line.trim()}
              </span>
            ))}
          </div>
        )}

        {drug.source && (
          <p className="text-xs text-drug-muted mt-2 uppercase tracking-wide">Source: {drug.source}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-drug-muted hover:bg-gray-50 border border-drug-border'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6" id="drug-tab-content">

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {drug.overview && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Overview</h2>
                <p className="text-drug-text leading-relaxed">{drug.overview}</p>
              </div>
            )}

            {drug.strength && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Strength</h2>
                {renderCSV(drug.strength)}
              </div>
            )}

            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">What it's used for</h2>
              {drug.indications
                ? renderCSV(drug.indications)
                : <em className="text-drug-muted">No data available</em>}
            </div>

            {drug.therapeutic_note && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Therapeutic Note</h2>
                <p className="text-drug-text leading-relaxed">{drug.therapeutic_note}</p>
              </div>
            )}

            {drug.pharmacology && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Pharmacology</h2>
                <p className="text-drug-text leading-relaxed">{drug.pharmacology}</p>
              </div>
            )}

            {drug.nafdac_no && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">NAFDAC No.</h2>
                <p className="text-drug-text leading-relaxed">{drug.nafdac_no}</p>
              </div>
            )}

            {/* Special Populations — now fully clickable */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Special Populations</h2>
              <p className="text-sm text-drug-muted mb-4">Tap a card to jump to the relevant tab.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

                {/* Pregnancy → Safety tab */}
                <button
                  onClick={() => goToTab('safety')}
                  className="text-center p-4 bg-pink-50 rounded-xl hover:bg-pink-100 hover:shadow-md transition-all group border border-pink-100 hover:border-pink-300 cursor-pointer"
                >
                  <Baby className="w-6 h-6 text-pink-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-pink-900">Pregnancy</div>
                  <div className="text-xs text-pink-600 mt-1 font-medium">→ Safety tab</div>
                </button>

                {/* Lactation → Safety tab */}
                <button
                  onClick={() => goToTab('safety')}
                  className="text-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 hover:shadow-md transition-all group border border-blue-100 hover:border-blue-300 cursor-pointer"
                >
                  <Heart className="w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-blue-900">Lactation</div>
                  <div className="text-xs text-blue-600 mt-1 font-medium">→ Safety tab</div>
                </button>

                {/* Pediatric → Dosage tab */}
                <button
                  onClick={() => goToTab('dosage')}
                  className="text-center p-4 bg-green-50 rounded-xl hover:bg-green-100 hover:shadow-md transition-all group border border-green-100 hover:border-green-300 cursor-pointer"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">👶</span>
                  <div className="text-sm font-semibold text-green-900">Pediatric</div>
                  <div className="text-xs text-green-600 mt-1 font-medium">→ Dosage tab</div>
                </button>

                {/* Geriatric → Dosage tab */}
                <button
                  onClick={() => goToTab('dosage')}
                  className="text-center p-4 bg-amber-50 rounded-xl hover:bg-amber-100 hover:shadow-md transition-all group border border-amber-100 hover:border-amber-300 cursor-pointer"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">👴</span>
                  <div className="text-sm font-semibold text-amber-900">Geriatric</div>
                  <div className="text-xs text-amber-600 mt-1 font-medium">→ Dosage tab</div>
                </button>

              </div>
            </div>
          </>
        )}

        {/* ── DOSAGE ───────────────────────────────────────────────────── */}
        {activeTab === 'dosage' && (
          <>
            {/* Route of Administration summary card */}
            {detectedRoutes.length > 0 && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Routes of Administration</h2>
                <div className="flex flex-wrap gap-3">
                  {detectedRoutes.map(r => {
                    const meta = ROUTE_META[r];
                    return (
                      <div
                        key={r}
                        style={{ background: meta.bg, border: `1.5px solid ${meta.color}30` }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg"
                      >
                        <div
                          style={{ background: meta.color }}
                          className="w-2 h-2 rounded-full flex-shrink-0"
                        />
                        <span style={{ color: meta.color }} className="text-sm font-bold">
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dosage details */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Adult Dose</h2>
              <div className="text-xs text-drug-muted mb-4 flex items-center gap-1">
                <span>Route abbreviations are highlighted:</span>
                {['PO','IV','IM','SC'].map(r => (
                  <span
                    key={r}
                    style={{ background: ROUTE_META[r].bg, color: ROUTE_META[r].color, padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    {r}
                  </span>
                ))}
              </div>
              {drug.adult_dose
                ? renderDosageWithRoutes(drug.adult_dose)
                : <em className="text-drug-muted">No adult dosage information available.</em>}
            </div>

            {drug.child_dose && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Child Dose</h2>
                {renderDosageWithRoutes(drug.child_dose)}
              </div>
            )}

            {drug.renal_dose && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Renal Dose</h2>
                {renderDosageWithRoutes(drug.renal_dose)}
              </div>
            )}

            {drug.administration && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Administration</h2>
                {renderList(drug.administration, '\n')}
              </div>
            )}

            {drug.nstg_recommendations && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">NSTG Recommendations</h2>
                {renderList(drug.nstg_recommendations, '\n')}
              </div>
            )}
          </>
        )}

        {/* ── SAFETY ───────────────────────────────────────────────────── */}
        {activeTab === 'safety' && (
          <>
            {/* Pregnancy & Lactation highlight */}
            <div className="section-card p-5">
              <h2 className="text-lg font-bold mb-3">Pregnancy &amp; Lactation</h2>
              {drug.pregnancy_lactation ? (
                <p className="text-sm text-drug-text leading-relaxed">{drug.pregnancy_lactation}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Baby className="w-4 h-4 text-pink-600" />
                      <span className="font-semibold text-pink-900 text-sm">Pregnancy</span>
                    </div>
                    <p className="text-sm text-pink-800 leading-relaxed">
                      Refer to contraindications and consult current prescribing information.
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-900 text-sm">Lactation</span>
                    </div>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Consult current prescribing information for breastfeeding guidance.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {drug.contraindications && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3 text-red-700">Contra-indications</h2>
                {renderList(drug.contraindications, '\n')}
              </div>
            )}

            {drug.precautions && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3 text-amber-700">Precautions</h2>
                {renderList(drug.precautions, '\n')}
              </div>
            )}

            {drug.adverse_effect && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Adverse Effect</h2>
                {renderList(drug.adverse_effect, '\n')}
              </div>
            )}

            {drug.advice_to_patients && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Advice to Patients</h2>
                {renderList(drug.advice_to_patients, '\n')}
              </div>
            )}

            {drug.pharmacovigilance && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Pharmacovigilance</h2>
                <p className="text-drug-text leading-relaxed">{drug.pharmacovigilance}</p>
              </div>
            )}

            {!drug.contraindications && !drug.adverse_effect && !drug.precautions && (
              <div className="section-card p-6">
                <em className="text-drug-muted">No safety data available.</em>
              </div>
            )}
          </>
        )}

        {/* ── INTERACTIONS ─────────────────────────────────────────────── */}
        {activeTab === 'interactions' && (
          <div className="section-card p-6">
            <h2 className="text-lg font-bold mb-4">Drug Interactions</h2>
            <p className="text-drug-muted text-sm mb-4">
              Always verify interactions against current prescribing information.
              Consult a pharmacist for patient-specific interaction checking.
            </p>
            {drug.interaction
              ? renderList(drug.interaction, '\n')
              : <em className="text-drug-muted">Detailed interaction data not available. Refer to product monograph.</em>}
          </div>
        )}

        {/* ── PHARMACOLOGY ─────────────────────────────────────────────── */}
        {activeTab === 'pharmacology' && (
          <>
            {drug.pharmacology && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Pharmacology</h2>
                <p className="text-drug-text leading-relaxed">{drug.pharmacology}</p>
              </div>
            )}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Drug Class</h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/browse?class=${encodeURIComponent(drug.drug_class || '')}`}
                  className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium hover:bg-primary-100 transition-colors"
                >
                  {drug.drug_class}
                </Link>
                {drug.drug_subclass && drug.drug_subclass !== drug.drug_class && (
                  <Link
                    to={`/browse?class=${encodeURIComponent(drug.drug_subclass)}`}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {drug.drug_subclass}
                  </Link>
                )}
              </div>
            </div>

            {drug.product_description && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Product Description</h2>
                <p className="text-drug-text leading-relaxed">{drug.product_description}</p>
              </div>
            )}

            {(drug.storage_recommendations || drug.pack_size_price) && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Storage &amp; Pack Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {drug.storage_recommendations && (
                    <div>
                      <div className="text-sm font-semibold text-drug-muted mb-1">Storage Recommendations</div>
                      <p className="text-drug-text text-sm leading-relaxed">{drug.storage_recommendations}</p>
                    </div>
                  )}
                  {drug.pack_size_price && (
                    <div>
                      <div className="text-sm font-semibold text-drug-muted mb-1">Pack Size &amp; Price</div>
                      <p className="text-drug-text text-sm leading-relaxed">{drug.pack_size_price}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!drug.pharmacology && (
              <div className="section-card p-6">
                <em className="text-drug-muted">No pharmacology data available.</em>
              </div>
            )}
          </>
        )}

        {/* ── NURSING NOTES ────────────────────────────────────────────── */}
        {activeTab === 'nursing' && (
          <div className="section-card p-6">
            <h2 className="text-lg font-bold mb-4">Nursing Action</h2>
            {drug.nursing_action
              ? renderList(drug.nursing_action, '\n')
              : <em className="text-drug-muted">No nursing-specific notes available for this drug.</em>}
          </div>
        )}

        {/* ── AI INSIGHTS ──────────────────────────────────────────────── */}
        {activeTab === 'ai-insights' && <AiInsightsTab drug={drug} />}

      </div>

      {/* Footer disclaimer */}
      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        <strong>Disclaimer:</strong> This information is for educational and clinical reference purposes only.
        Always verify drug information against current product monographs and consult appropriate clinical resources
        before prescribing or administering medications.
      </div>
    </div>
  );
}
