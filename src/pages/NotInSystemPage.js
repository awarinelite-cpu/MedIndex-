// Opens automatically when a Home search matches nothing in the app. Everything
// is in drop-down buttons: Google search for a condition, Google search for a
// drug, and the AI Insight & AI lookup tools.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Pill, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDrugs } from '../hooks/useDrugs';
import { ConditionGooglePanel } from '../components/NewConditionGoogleSearch';
import NewDrugGoogleSearch from '../components/NewDrugGoogleSearch';
import ConditionInsightCard from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';

function Drop({ icon: Icon, title, open, onToggle, children }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 rounded-xl bg-[#E4EEFF] border border-[#C9DAF6] px-3 py-3 text-[15px] font-semibold text-[#0A1F5C]"
      >
        <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-left">{title}</span>
        {open ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export default function NotInSystemPage() {
  const { isAdmin } = useAuth();
  const { drugs } = useDrugs();
  const [params] = useSearchParams();
  const label = (params.get('q') || '').trim();
  const [open, setOpen] = useState(null); // 'condition' | 'drug' | null
  const toggle = (k) => setOpen(o => (o === k ? null : k));

  if (!label) {
    return <p className="p-4 text-sm text-drug-muted">Nothing to look up. Go back and search for a term first.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
      <div className="mb-1">
        <p className="text-xs font-semibold text-drug-muted">Not in the system yet</p>
        <h1 className="text-2xl font-extrabold text-[#0A1F5C]">“{label}”</h1>
      </div>

      {isAdmin && (
        <>
          <Drop icon={Stethoscope} title={`Search Google: “${label}” as a condition`}
            open={open === 'condition'} onToggle={() => toggle('condition')}>
            <ConditionGooglePanel query={label} />
          </Drop>
          <Drop icon={Pill} title={`Search Google: “${label}” as a drug`}
            open={open === 'drug'} onToggle={() => toggle('drug')}>
            <NewDrugGoogleSearch label={label} />
          </Drop>
        </>
      )}

      {/* AI Insight & AI lookup (its own drop-down button) */}
      <ConditionInsightCard
        searchQuery={label}
        existingDrugs={drugs || []}
        aiExtra={<AiSearchFallback searchQuery={label} />}
      />
    </div>
  );
}
