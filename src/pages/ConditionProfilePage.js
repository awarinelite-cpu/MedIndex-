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
  FlaskConical, Heart, Home, Info, Pill, Search, Share2, Target, User,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { useConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import { useFavourites, conditionFavKey } from '../hooks/useFavourites';
import { groupDrugsByCondition } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { classifyDrugsByRole, getTreatmentCategory, TREATMENT_CATEGORY_ORDER } from '../utils/drugRoleClassification';
import { getDisplayDrugClass } from '../utils/drugCategory';
import { hasNoDistinctTypes, hasNoSurgicalManagement } from '../utils/parseConditionClinicalInfo';
import { renderAiText } from '../utils/renderAiText';
import { shareConditionNotePdf } from '../utils/exportConditionNotePdf';

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

const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// First sentence of the introduction, with markdown marks removed.
function firstSentence(text) {
  const clean = String(text || '').replace(/^#+\s.*$/gm, '').replace(/[*_`>-]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const m = clean.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : clean).trim();
}

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

function CategoryGroup({ title, count, open, onToggle, children }) {
  return (
    <div className={`cp-cat ${open ? 'is-open' : ''}`}>
      <button type="button" className="cp-cat-head" onClick={onToggle} aria-expanded={open}>
        <span className="cp-cat-icon">{categoryIcon(title)}</span>
        <span className="cp-cat-title">{title}</span>
        <span className="cp-cat-count">{count}</span>
        {open ? <ChevronUp size={22} strokeWidth={2.6} /> : <ChevronDown size={22} strokeWidth={2.6} />}
      </button>
      {open && <div className="cp-cat-body">{children}</div>}
    </div>
  );
}

function DrugRow({ drug, role, inCombination }) {
  const label = role === 'main' ? 'First-line option' : 'Alternative option';
  return (
    <Link to={`/drug/${drug.id}`} className="cp-drug">
      <DrugThumb drug={drug} />
      <span className="cp-drug-text">
        <span className="cp-drug-name">{drug.generic_name}</span>
        <span className="cp-drug-sub">{drug.drug_subclass || getDisplayDrugClass(drug)}</span>
      </span>
      <span className={`cp-tag ${role === 'main' ? 'is-first' : 'is-alt'}`}>
        {label}
        {role === 'main' && inCombination && <span className="cp-tag-extra">(in combinations)</span>}
      </span>
      <ChevronRight size={22} strokeWidth={2.4} className="cp-drug-go" />
    </Link>
  );
}

function RegimenRow({ regimen }) {
  const parts = (Array.isArray(regimen.combination_components) ? regimen.combination_components : [])
    .map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
  return (
    <Link to={`/drug/${regimen.id}`} className="cp-drug">
      <span className="cp-thumb cp-thumb-fallback" aria-hidden="true"><Boxes size={22} strokeWidth={2} /></span>
      <span className="cp-drug-text">
        <span className="cp-drug-name">{regimen.generic_name}</span>
        {parts.length > 0 && <span className="cp-drug-sub">{parts.join(' + ')}</span>}
      </span>
      <span className="cp-tag is-alt">Regimen</span>
      <ChevronRight size={22} strokeWidth={2.4} className="cp-drug-go" />
    </Link>
  );
}

function MedicationsCard({ buckets }) {
  const [openCats, setOpenCats] = useState(null); // null = first group open by default

  const { groups, regimens, comboNames } = useMemo(() => {
    const map = new Map();
    const add = (drug, role) => {
      const cat = getTreatmentCategory(drug) || (getDisplayDrugClass(drug) || '').trim() || OTHER;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ drug, role });
    };
    buckets.main.forEach(d => add(d, 'main'));
    buckets.adjunct.forEach(d => add(d, 'adjunct'));

    const rank = (c) => { const i = TREATMENT_CATEGORY_ORDER.indexOf(c); return i === -1 ? 1000 : i; };
    const sorted = [...map.entries()]
      .map(([cat, items]) => [cat, items.sort((a, b) =>
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
  }, [buckets]);

  const allKeys = [...groups.map(([c]) => c), ...(regimens.length ? [REGIMENS] : [])];
  const open = openCats || new Set(allKeys.slice(0, 1));
  const toggle = (key) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key); else next.add(key);
    setOpenCats(next);
  };

  if (allKeys.length === 0) {
    return (
      <section className="cp-card">
        <h2 className="cp-card-title"><span className="cp-card-icon"><Pill size={30} strokeWidth={2.4} /></span>Medications Used for this Condition</h2>
        <p className="cp-empty">No medications have been linked to this condition yet.</p>
      </section>
    );
  }

  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <span className="cp-card-icon"><Pill size={34} strokeWidth={2.4} style={{ transform: 'rotate(-45deg)' }} /></span>
        <div>
          <h2 className="cp-card-title cp-card-title-lg">Medications Used for this Condition</h2>
          <p className="cp-card-sub">Organised by treatment category</p>
        </div>
      </div>

      <div className="cp-cats">
        {groups.map(([cat, items]) => (
          <CategoryGroup key={cat} title={sentenceCase(cat)} count={items.length} open={open.has(cat)} onToggle={() => toggle(cat)}>
            {items.map(({ drug, role }) => (
              <DrugRow key={drug.id} drug={drug} role={role} inCombination={comboNames.has(norm(drug.generic_name))} />
            ))}
          </CategoryGroup>
        ))}
        {regimens.length > 0 && (
          <CategoryGroup title={REGIMENS} count={regimens.length} open={open.has(REGIMENS)} onToggle={() => toggle(REGIMENS)}>
            {regimens.map(r => <RegimenRow key={r.id} regimen={r} />)}
          </CategoryGroup>
        )}
      </div>

      <div className="cp-note" role="note">
        <Info size={22} strokeWidth={2.2} />
        <p>Treatment options may vary based on individual patient factors. Always refer to current clinical guidelines.</p>
      </div>
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
  const { clinicalInfoByCondition } = useConditionClinicalInfo();

  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef(null);

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
      await shareConditionNotePdf({ id: systemId, name: system?.name }, entry.condition, entry.drugs, info);
    } catch (e) {
      setShareError(e.message || 'Could not share this condition.');
    } finally {
      setSharing(false);
    }
  };

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/conditions'));

  const summary = firstSentence(info?.introduction);
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
        <section className="cp-card cp-about" ref={aboutRef}>
          <button type="button" className="cp-about-head" onClick={() => setAboutOpen(o => !o)} aria-expanded={aboutOpen}>
            <span className="cp-about-main">
              <span className="cp-card-title"><span className="cp-card-icon"><Info size={30} strokeWidth={2.2} /></span>About this Condition</span>
              {info?.introduction
                ? <span className={`cp-about-text ${aboutOpen ? 'is-open' : ''}`}>{renderAiText(info.introduction)}</span>
                : <span className="cp-about-text is-open">Clinical details have not been added for this condition yet.</span>}
            </span>
            {info?.introduction && (aboutOpen ? <ChevronUp size={22} strokeWidth={2.6} className="cp-about-chev" /> : <ChevronRight size={22} strokeWidth={2.6} className="cp-about-chev" />)}
          </button>
          {aboutOpen && detailSections.length > 0 && (
            <div className="cp-detail">
              {detailSections.map(([key, label]) => (
                <div key={key} className="cp-detail-section">
                  <h3>{label}</h3>
                  <div className="cp-prose">{renderAiText(info[key])}</div>
                </div>
              ))}
            </div>
          )}
        </section>
        <MedicationsCard buckets={buckets} />
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
        {summary && <p className="cp-summary">{summary}</p>}
        {shareError && <p className="cp-error" role="alert">{shareError}</p>}

        </div>

        <div className="cp-content">{content}</div>
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
