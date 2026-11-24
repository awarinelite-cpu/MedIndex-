// src/pages/ConditionProfilePage.js
// Route: /condition/:systemId/:conditionId
// Standalone "Condition Profile" screen: blue app bar, condition header with
// system + profile badges, tab pills, an About card, and the medications used
// for the condition grouped into expandable treatment categories. It reads the
// same live data as the system page (tags, role buckets, clinical info), so
// nothing new is stored or migrated.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ExternalLink, FileText, ListChecks, FlaskConical, Trash2, Heart, Home, Info, Pill, Search, Share2, Target, User,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { useConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import ConditionImagesPanel from '../components/ConditionImagesPanel';
import PasteMedicationsPanel from '../components/PasteMedicationsPanel';
import ConditionGoogleInfo from '../components/ConditionGoogleInfo';
import { useAuth } from '../context/AuthContext';
import { deleteReviewedDrug } from '../utils/aiDrugSave';
import { useFavourites, conditionFavKey } from '../hooks/useFavourites';
import { groupDrugsByCondition } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { classifyDrugsByRole, getTreatmentCategory, TREATMENT_CATEGORY_ORDER } from '../utils/drugRoleClassification';
import { getDisplayDrugClass } from '../utils/drugCategory';
import { hasNoDistinctTypes, hasNoSurgicalManagement } from '../utils/parseConditionClinicalInfo';
import { renderAiText } from '../utils/renderAiText';
import { shareConditionNotePdf } from '../utils/exportConditionNotePdf';
import { shareConditionNoteDocx } from '../utils/exportConditionNoteDocx';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const OTHER = 'Other relevant treatments';
const REGIMENS = 'Combination Treatment Regimens';

// Antibody glyph (Y shape) since the icon set has no antibody icon.
function AntibodyIcon({ size = 24, color = '#6D3FD1' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21v-8" />
      <path d="M12 13 6 6" />
      <path d="M12 13l6-7" />
      <circle cx="5.2" cy="4.8" r="1.3" fill={color} />
      <circle cx="18.8" cy="4.8" r="1.3" fill={color} />
    </svg>
  );
}

function categoryIcon(title) {
  switch (title) {
    case 'Targeted therapies': return <Target size={26} color="#E5322D" strokeWidth={2.2} />;
    case 'Monoclonal antibodies': return <AntibodyIcon size={26} />;
    case 'Chemotherapy': return <FlaskConical size={26} color="#F59E0B" strokeWidth={2.2} />;
    case REGIMENS: return <Boxes size={26} color="#1769E0" strokeWidth={2.2} />;
    default: return <Pill size={26} color="#1769E0" strokeWidth={2.2} />;
  }
}

// Double-tap (two quick taps/clicks) anywhere inside an element closes it.
// Use as onClickCapture. The window only starts when the element was open at
// the first tap; the second tap is swallowed so a header button cannot re-open it.
function useDoubleTapClose(isOpen, onClose, enabled = true) {
  const last = useRef(0);
  return (e) => {
    if (!enabled) { last.current = 0; return; }
    const now = Date.now();
    if (last.current && now - last.current < 350) {
      last.current = 0;
      e.preventDefault();
      e.stopPropagation();
      try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
      onClose();
      return;
    }
    last.current = isOpen ? now : 0;
  };
}

const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function DrugThumb({ drug }) {
  const [failed, setFailed] = useState(false);
  if (drug.image_url && !failed) {
    return <img className="cp-thumb" src={drug.image_url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className="cp-thumb cp-thumb-fallback" aria-hidden="true">
      <Pill size={22} strokeWidth={2} />
    </span>
  );
}

function CategoryGroup({ title, count, open, onToggle, onClose, canDoubleTap = true, extra = null, children }) {
  const onDoubleTap = useDoubleTapClose(open, onClose || (() => {}), canDoubleTap && !!onClose);
  return (
    <div className={`cp-cat ${open ? 'is-open' : ''}`} onClickCapture={onDoubleTap}>
      <button type="button" className="cp-cat-head" onClick={onToggle} aria-expanded={open}>
        <span className="cp-cat-icon">{categoryIcon(title)}</span>
        <span className="cp-cat-title">{title}</span>
        <span className="cp-cat-count">{count}</span>
        {open ? <ChevronUp size={22} strokeWidth={2.6} /> : <ChevronDown size={22} strokeWidth={2.6} />}
      </button>
      {extra}
      {open && <div className="cp-cat-body">{children}</div>}
    </div>
  );
}

// Admin-only small trash icon on a drug row: permanently deletes the drug.
function DeleteDrugButton({ drug }) {
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  const onClick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    if (drug._seed) { window.alert(`"${drug.generic_name}" is built-in sample data and cannot be deleted here.`); return; }
    if (!window.confirm(`Delete "${drug.generic_name}" from the system?\n\nThis permanently removes the drug and its information, and it will disappear from every condition it is listed under.`)) return;
    setBusy(true);
    try { await deleteReviewedDrug({ id: drug.id }); }
    catch (err) { window.alert(`Could not delete: ${err.message || err}`); setBusy(false); }
  };
  return (
    <button type="button" className="cp-drug-del" onClick={onClick} disabled={busy} aria-label={`Delete ${drug.generic_name}`} title="Delete drug">
      <Trash2 size={16} strokeWidth={2.2} />
    </button>
  );
}

// Admin bulk-select state handed down from MedicationsCard: { on, ids:Set, toggle(id) }.
function SelectBox({ checked }) {
  return <span className={`cp-sel-check ${checked ? 'is-on' : ''}`} aria-hidden="true">{checked && <Check size={16} strokeWidth={3.2} />}</span>;
}

function DrugRow({ drug, role, inCombination, sel }) {
  const label = role === 'main' ? 'First-line option' : 'Alternative option';
  const selecting = !!sel?.on;
  const body = (
    <>
      {selecting && <SelectBox checked={sel.ids.has(drug.id)} />}
      <DrugThumb drug={drug} />
      <span className="cp-drug-text">
        <span className="cp-drug-name">{drug.generic_name}</span>
        <span className="cp-drug-sub">{drug.drug_subclass || getDisplayDrugClass(drug)}</span>
      </span>
      <span className={`cp-tag ${role === 'main' ? 'is-first' : 'is-alt'}`}>
        {label}
        {role === 'main' && inCombination && <span className="cp-tag-extra">(in combinations)</span>}
      </span>
      {!selecting && <DeleteDrugButton drug={drug} />}
      {!selecting && <ChevronRight size={22} strokeWidth={2.4} className="cp-drug-go" />}
    </>
  );
  if (selecting) {
    return (
      <div role="checkbox" aria-checked={sel.ids.has(drug.id)} tabIndex={0}
        className={`cp-drug cp-drug-select ${sel.ids.has(drug.id) ? 'is-selected' : ''}`}
        onClick={() => sel.toggle(drug.id)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sel.toggle(drug.id); } }}>
        {body}
      </div>
    );
  }
  return <Link to={`/drug/${drug.id}`} className="cp-drug">{body}</Link>;
}

function RegimenRow({ regimen, sel }) {
  const parts = (Array.isArray(regimen.combination_components) ? regimen.combination_components : [])
    .map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
  const selecting = !!sel?.on;
  const body = (
    <>
      {selecting && <SelectBox checked={sel.ids.has(regimen.id)} />}
      <span className="cp-thumb cp-thumb-fallback" aria-hidden="true"><Boxes size={22} strokeWidth={2} /></span>
      <span className="cp-drug-text">
        <span className="cp-drug-name">{regimen.generic_name}</span>
        {parts.length > 0 && <span className="cp-drug-sub">{parts.join(' + ')}</span>}
      </span>
      <span className="cp-tag is-alt">Regimen</span>
      {!selecting && <DeleteDrugButton drug={regimen} />}
      {!selecting && <ChevronRight size={22} strokeWidth={2.4} className="cp-drug-go" />}
    </>
  );
  if (selecting) {
    return (
      <div role="checkbox" aria-checked={sel.ids.has(regimen.id)} tabIndex={0}
        className={`cp-drug cp-drug-select ${sel.ids.has(regimen.id) ? 'is-selected' : ''}`}
        onClick={() => sel.toggle(regimen.id)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sel.toggle(regimen.id); } }}>
        {body}
      </div>
    );
  }
  return <Link to={`/drug/${regimen.id}`} className="cp-drug">{body}</Link>;
}

// Opens a Google search for the medications used to treat this condition.
function GoogleMedsButton({ name }) {
  const { isAdmin } = useAuth();
  if (!isAdmin || !name) return null; // admin-only
  const url = `https://www.google.com/search?q=${encodeURIComponent(`${name} treatment medications list`)}`;
  return (
    <a className="cp-google-btn" href={url} target="_blank" rel="noopener noreferrer">
      <Search size={18} strokeWidth={2.4} />
      <span>Search medications on Google</span>
      <ExternalLink size={16} strokeWidth={2.4} />
    </a>
  );
}

// Admin-only dropdown that keeps the Google search, paste box and guideline note folded away.
function MedsToolsDropdown({ conditionId, conditionName }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`cp-cat ${open ? 'is-open' : ''}`} style={{ marginTop: 14 }}>
      <button type="button" className="cp-cat-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="cp-cat-icon"><Search size={20} strokeWidth={2.4} /></span>
        <span className="cp-cat-title">Search &amp; paste medications</span>
        {open ? <ChevronUp size={22} strokeWidth={2.6} /> : <ChevronDown size={22} strokeWidth={2.6} />}
      </button>
      {open && (
        <div className="cp-cat-body cp-tools-body">
          <GoogleMedsButton name={conditionName} />
          <PasteMedicationsPanel conditionId={conditionId} conditionName={conditionName} />
          <div className="cp-note" role="note">
            <Info size={22} strokeWidth={2.2} />
            <p>Treatment options may vary based on individual patient factors. Always refer to current clinical guidelines.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MedicationsCard({ buckets, conditionName, conditionId }) {
  const { isAdmin } = useAuth();
  const adminTools = isAdmin ? <MedsToolsDropdown conditionId={conditionId} conditionName={conditionName} /> : null;
  const [openCats, setOpenCats] = useState(null); // null = first group open by default

  const { groups, regimens, comboNames } = useMemo(() => {
    const map = new Map();
    const saved = new Map(); // heading -> lowest paste order, to keep the pasted heading order
    const add = (drug, role) => {
      const g = drug.condition_groups?.[conditionId];
      const cat = g?.heading || getTreatmentCategory(drug) || (getDisplayDrugClass(drug) || '').trim() || OTHER;
      if (g?.heading) saved.set(cat, Math.min(saved.get(cat) ?? Infinity, g.hOrder || 0));
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ drug, role, sub: g?.sub || '', order: g?.order ?? Infinity });
    };
    buckets.main.forEach(d => add(d, 'main'));
    buckets.adjunct.forEach(d => add(d, 'adjunct'));

    const rank = (c) => {
      if (saved.has(c)) return -1000 + saved.get(c); // pasted headings first, in pasted order
      const i = TREATMENT_CATEGORY_ORDER.indexOf(c); return i === -1 ? 1000 : i;
    };
    const sorted = [...map.entries()]
      .map(([cat, items]) => [cat, items.sort((a, b) =>
        (a.order - b.order || 0) ||
        (a.role === b.role ? 0 : a.role === 'main' ? -1 : 1) ||
        (a.drug.generic_name || '').localeCompare(b.drug.generic_name || '', 'en', { sensitivity: 'base' }))])
      .sort((a, b) => (rank(a[0]) - rank(b[0])) || ((a[0] === OTHER) - (b[0] === OTHER)) || a[0].localeCompare(b[0]));

    const names = new Set();
    (buckets.combination || []).forEach(r => {
      (Array.isArray(r.combination_components) ? r.combination_components : [])
        .map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
        .forEach(n => names.add(norm(n)));
    });
    return { groups: sorted, regimens: buckets.combination || [], comboNames: names };
  }, [buckets, conditionId]);

  const allKeys = [...groups.map(([c]) => c), ...(regimens.length ? [REGIMENS] : [])];
  // Admin-only bulk select / delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [delProgress, setDelProgress] = useState('');
  const selectable = useMemo(() => {
    const byId = new Map();
    groups.forEach(([, items]) => items.forEach(({ drug }) => byId.set(drug.id, drug)));
    regimens.forEach(r => byId.set(r.id, r));
    return [...byId.values()].filter(d => !d._seed);
  }, [groups, regimens]);
  const sel = isAdmin ? {
    on: selectMode,
    ids: selectedIds,
    toggle: (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
  } : null;
  const allSelected = selectable.length > 0 && selectable.every(d => selectedIds.has(d.id));
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const deleteSelected = async () => {
    const targets = selectable.filter(d => selectedIds.has(d.id));
    if (!targets.length || deleting) return;
    if (!window.confirm(`Delete ${targets.length} item${targets.length === 1 ? '' : 's'} from the system?\n\nThis permanently removes ${targets.length === 1 ? 'it' : 'them'} and all their information, and ${targets.length === 1 ? 'it' : 'they'} will disappear from every condition ${targets.length === 1 ? 'it is' : 'they are'} listed under.`)) return;
    setDeleting(true);
    const failed = [];
    for (let i = 0; i < targets.length; i++) {
      setDelProgress(`Deleting ${i + 1} of ${targets.length}…`);
      try { await deleteReviewedDrug({ id: targets[i].id }); }
      catch (err) { failed.push(`${targets[i].generic_name}: ${err.message || err}`); }
    }
    setDelProgress('');
    setDeleting(false);
    if (failed.length) {
      window.alert(`${targets.length - failed.length} deleted. ${failed.length} failed:\n\n${failed.slice(0, 5).join('\n')}`);
      setSelectedIds(new Set(targets.filter(d => failed.some(f => f.startsWith(`${d.generic_name}:`))).map(d => d.id)));
    } else {
      exitSelect();
    }
  };

  // Every dropdown starts closed until it is tapped.
  const open = selectMode ? new Set(allKeys) : (openCats || new Set());
  const toggle = (key) => {
    if (selectMode) return; // everything stays open while selecting
    const next = new Set(open);
    if (next.has(key)) next.delete(key); else next.add(key);
    setOpenCats(next);
  };
  const closeCat = (key) => {
    if (selectMode) return;
    const next = new Set(open);
    next.delete(key);
    setOpenCats(next);
  };

  // Small select icon, shown directly below the first category header.
  const selectIcon = isAdmin && !selectMode ? (
    <div className="cp-sel-icon-row">
      <button type="button" className="cp-sel-icon" onClick={() => setSelectMode(true)} aria-label="Select medications" title="Select">
        <ListChecks size={16} strokeWidth={2.4} />
      </button>
    </div>
  ) : null;

  if (allKeys.length === 0) {
    return (
      <section className="cp-card">
        <h2 className="cp-card-title"><span className="cp-card-icon"><Pill size={30} strokeWidth={2.4} /></span>Medications Used for this Condition</h2>
        <p className="cp-empty">No medications have been linked to this condition yet.</p>
        {adminTools}
      </section>
    );
  }

  return (
    <section className="cp-card">
      <div className="cp-meds-hero">
        <span className="cp-meds-icon" aria-hidden="true"><Pill size={30} strokeWidth={2.2} style={{ transform: 'rotate(-45deg)' }} /></span>
        <div className="cp-meds-text">
          <h2 className="cp-meds-title">Medications Used for this Condition</h2>
          <p className="cp-meds-sub">Organised by treatment category</p>
        </div>
        <div className="cp-meds-strip">
          <span className="cp-meds-chip"><i className="cp-dot is-a" /><b>{groups.reduce((n, [, items]) => n + items.length, 0) + regimens.length}</b> medications</span>
          <span className="cp-meds-chip"><i className="cp-dot is-b" /><b>{groups.length}</b> {groups.length === 1 ? 'category' : 'categories'}</span>
        </div>
      </div>

      {isAdmin && selectMode && (
        <div className="cp-sel-bar" role="toolbar" aria-label="Bulk actions">
          <button type="button" className="cp-sel-btn" disabled={deleting}
            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(selectable.map(d => d.id)))}>
            <ListChecks size={16} strokeWidth={2.4} /> {allSelected ? 'Clear all' : `Select all (${selectable.length})`}
          </button>
          <button type="button" className="cp-sel-btn is-danger" disabled={deleting || selectedIds.size === 0} onClick={deleteSelected}>
            <Trash2 size={15} strokeWidth={2.4} /> {delProgress || `Delete (${selectedIds.size})`}
          </button>
          <button type="button" className="cp-sel-btn is-ghost" disabled={deleting} onClick={exitSelect}>Cancel</button>
        </div>
      )}

      <div className="cp-cats">
        {groups.map(([cat, items], gi) => (
          <CategoryGroup key={cat} title={sentenceCase(cat)} count={items.length} open={open.has(cat)} onToggle={() => toggle(cat)}
            onClose={() => closeCat(cat)} canDoubleTap={!selectMode} extra={gi === 0 ? selectIcon : null}>
            {items.map(({ drug, role, sub }, i) => (
              <React.Fragment key={drug.id}>
                {sub !== (items[i - 1]?.sub || '') && (sub || items[i - 1]?.sub) && <div className="cp-sub-head">{sub || 'Other'}</div>}
                <DrugRow drug={drug} role={role} inCombination={comboNames.has(norm(drug.generic_name))} sel={sel} />
              </React.Fragment>
            ))}
          </CategoryGroup>
        ))}
        {regimens.length > 0 && (
          <CategoryGroup title={REGIMENS} count={regimens.length} open={open.has(REGIMENS)} onToggle={() => toggle(REGIMENS)}
            onClose={() => closeCat(REGIMENS)} canDoubleTap={!selectMode} extra={groups.length === 0 ? selectIcon : null}>
            {regimens.map(r => <RegimenRow key={r.id} regimen={r} sel={sel} />)}
          </CategoryGroup>
        )}
      </div>

      {adminTools}

      {!isAdmin && (
        <div className="cp-note" role="note">
          <Info size={22} strokeWidth={2.2} />
          <p>Treatment options may vary based on individual patient factors. Always refer to current clinical guidelines.</p>
        </div>
      )}
    </section>
  );
}

// Everything known about a condition, in reading order. Shown inside the
// About card when it is opened.
const DETAIL_SECTIONS = [
  ['types', 'Types'],
  ['organRelated', 'Organ System Involved'],
  ['etiology', 'Etiology'],
  ['pathology', 'Pathophysiology'],
  ['clinicalManifestation', 'Clinical Manifestation'],
  ['diagnosis', 'Diagnosis and Investigation'],
  ['management', 'Medical Management'],
  ['surgicalManagement', 'Surgical Management'],
  ['nursingDiagnosis', 'Nursing Diagnosis'],
  ['nursingConsideration', 'Nursing Consideration'],
];

function isApplicable(key, body) {
  if (!body) return false;
  if (key === 'types') return !hasNoDistinctTypes(body);
  if (key === 'surgicalManagement') return !hasNoSurgicalManagement(body);
  return true;
}

export default function ConditionProfilePage() {
  const { systemId, conditionId } = useParams();
  const navigate = useNavigate();
  const { drugs } = useDrugs();
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem, loading: condLoading } = useCustomConditions();
  const { clinicalInfoByCondition, imagesByCondition } = useConditionClinicalInfo();

  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef(null);
  const aboutDoubleTap = useDoubleTapClose(aboutOpen, () => setAboutOpen(false));

  // Tapping anywhere outside the About card closes it. Uses click, not
  // pointerdown, so scrolling with a finger on the page does not close it.
  useEffect(() => {
    if (!aboutOpen) return undefined;
    const onClick = (e) => {
      if (aboutRef.current && !aboutRef.current.contains(e.target)) setAboutOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [aboutOpen]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const { isFav, toggle: toggleFav } = useFavourites();
  const favKey = conditionFavKey(systemId, conditionId);
  const saved = isFav('condition', favKey);

  const system = useMemo(() => ANATOMICAL_SYSTEMS.find(s => s.id === systemId) || null, [systemId]);

  const entry = useMemo(() => {
    const grouped = groupDrugsByCondition(
      drugs || [], systemId,
      customConditionsBySystem?.[systemId] || [],
      hiddenConditionIdsBySystem?.[systemId] || [],
      labelOverridesBySystem?.[systemId] || {},
    );
    return grouped.get(conditionId) || null;
  }, [drugs, systemId, conditionId, customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem]);

  const buckets = useMemo(() => {
    if (!entry) return { main: [], adjunct: [], combination: [] };
    return classifyDrugsByRole(entry.drugs, entry.condition);
  }, [entry]);

  const info = clinicalInfoByCondition?.[conditionId] || null;
  const systemName = (system?.name || systemId || '').split(' & ')[0];

  const toggleSaved = () => {
    if (!entry) return;
    toggleFav({
      type: 'condition', refId: favKey, systemId, conditionId,
      name: entry.condition.label, subtitle: systemName,
    });
  };

  const share = async () => {
    if (!entry || sharing) return;
    setSharing(true);
    setShareError('');
    try {
      await shareConditionNotePdf({ id: systemId, name: system?.name }, entry.condition, entry.drugs, info, imagesByCondition?.[entry.condition.id]);
    } catch (e) {
      setShareError(e.message || 'Could not share this condition.');
    } finally {
      setSharing(false);
    }
  };

  const [sharingWord, setSharingWord] = useState(false);
  const shareWord = async () => {
    if (!entry || sharingWord) return;
    setSharingWord(true);
    setShareError('');
    try {
      await shareConditionNoteDocx({ id: systemId, name: system?.name }, entry.condition, entry.drugs, info, imagesByCondition?.[entry.condition.id]);
    } catch (e) {
      setShareError(e.message || 'Could not share this condition as a Word document.');
    } finally {
      setSharingWord(false);
    }
  };

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/conditions'));

  const detailSections = DETAIL_SECTIONS.filter(([key]) => isApplicable(key, info?.[key]));

  let content;
  if (!entry && condLoading) {
    content = <p className="cp-empty">Loading condition...</p>;
  } else if (!entry) {
    content = (
      <section className="cp-card">
        <h2 className="cp-card-title">Condition not found</h2>
        <p className="cp-empty">This condition may have been renamed or removed. <Link to="/conditions" className="cp-link">Browse all conditions</Link></p>
      </section>
    );
  } else {
    content = (
      <>
        <section className="cp-card cp-about" ref={aboutRef} onClickCapture={aboutDoubleTap}>
          <button type="button" className="cp-about-head" onClick={() => setAboutOpen(o => !o)} aria-expanded={aboutOpen}>
            <span className="cp-about-main">
              <span className="cp-card-title"><span className="cp-card-icon"><Info size={30} strokeWidth={2.2} /></span>About this Condition</span>
              {info?.introduction
                ? <span className={`cp-about-text ${aboutOpen ? 'is-open' : ''}`}>{renderAiText(info.introduction, { clinical: true })}</span>
                : <span className="cp-about-text is-open">Clinical details have not been added for this condition yet.</span>}
            </span>
            {info?.introduction && (aboutOpen ? <ChevronUp size={22} strokeWidth={2.6} className="cp-about-chev" /> : <ChevronRight size={22} strokeWidth={2.6} className="cp-about-chev" />)}
          </button>
          {aboutOpen && detailSections.length > 0 && (
            <div className="cp-detail">
              {detailSections.map(([key, label]) => (
                <div key={key} className="cp-detail-section">
                  <h3>{label}</h3>
                  <div className="cp-prose">{renderAiText(info[key], { clinical: true })}</div>
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Admin only (the component hides itself for everyone else) */}
        <ConditionGoogleInfo condition={entry.condition} systemName={systemName} existingInfo={info} className="mt-3" />
        <MedicationsCard buckets={buckets} conditionName={entry?.condition?.label} conditionId={entry?.condition?.id} />
      </>
    );
  }

  const bottomTabs = [
    { to: '/', label: 'Home', icon: <Home size={30} strokeWidth={2} />, active: true },
    { to: '/browse', label: 'Search', icon: <Search size={30} strokeWidth={2} /> },
    { to: '/favourites', label: 'Favourites', icon: <Heart size={30} strokeWidth={2} /> },
    { to: '/more', label: 'Profile', icon: <User size={30} strokeWidth={2} /> },
  ];

  return (
    <div className="cp-screen">
      <header className="cp-bar">
        <button type="button" className="cp-bar-back" onClick={goBack}><ChevronLeft size={30} strokeWidth={2.4} />Back</button>
        <Link to="/" className="cp-bar-brand" aria-label="MedIndex home"><Activity size={40} strokeWidth={2.2} />MedIndex</Link>
        <div className="cp-bar-actions">
          <button type="button" className={`cp-bar-btn ${saved ? 'is-saved' : ''}`} onClick={toggleSaved} disabled={!entry} aria-pressed={saved} aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}>
            <Heart size={36} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="cp-bar-btn" onClick={shareWord} disabled={!entry || sharingWord} aria-label="Share condition as Word document">
            <FileText size={34} strokeWidth={2} />
          </button>
          <button type="button" className="cp-bar-btn" onClick={share} disabled={!entry || sharing} aria-label="Share condition">
            <Share2 size={34} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="cp-main">
        <div className="cp-top">
        <div className="cp-hero">
          <span className="cp-hero-icon" aria-hidden="true">{entry?.condition?.icon || '🩺'}</span>
          <div className="cp-hero-text">
            <h1>{entry?.condition?.label || 'Condition'}</h1>
            <div className="cp-badges">
              <Link to={`/system/${systemId}`} className="cp-badge is-system">{systemName}</Link>
              <span className="cp-badge is-profile"><span className="cp-badge-check"><Check size={16} strokeWidth={3.4} /></span>Condition Profile</span>
            </div>
          </div>
        </div>
        {shareError && <p className="cp-error" role="alert">{shareError}</p>}

        </div>

        <div className="cp-content">
          {entry?.condition && (
            <ConditionImagesPanel hero framed condition={entry.condition} images={imagesByCondition?.[entry.condition.id]} />
          )}
          {content}
        </div>
      </main>

      <nav className="cp-nav" aria-label="Main">
        {bottomTabs.map(t => (
          <Link key={t.label} to={t.to} className={`cp-nav-item ${t.active ? 'is-active' : ''}`} aria-current={t.active ? 'page' : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
