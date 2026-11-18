// Opened from the single "Not in the system" button under the home search bar.
// Two choices: look the term up as a CONDITION or as a DRUG. The AI lookup
// stays available at the bottom.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pill, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDrugs } from '../hooks/useDrugs';
import { ConditionGooglePanel } from '../components/NewConditionGoogleSearch';
import NewDrugGoogleSearch from '../components/NewDrugGoogleSearch';
import ConditionInsightCard from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';

const tabCls = (active, tone) =>
  `flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold text-[15px] border ${
    active
      ? `${tone === 'drug' ? 'bg-emerald-600 border-emerald-600' : 'bg-violet-600 border-violet-600'} text-white`
      : 'bg-white border-drug-border text-drug-text'
  }`;

export default function NotInSystemPage() {
  const { isAdmin } = useAuth();
  const { drugs } = useDrugs();
  const [params] = useSearchParams();
  const label = (params.get('q') || '').trim();
  const [mode, setMode] = useState(null); // 'condition' | 'drug'

  if (!label) {
    return <p className="p-4 text-sm text-drug-muted">Nothing to look up. Go back and search for a term first.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-drug-muted">Not in the system</p>
        <h1 className="text-2xl font-extrabold text-[#0A1F5C]">“{label}”</h1>
      </div>

      {isAdmin && (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('condition')} className={tabCls(mode === 'condition', 'condition')}>
              <Stethoscope className="w-5 h-5" /> Condition
            </button>
            <button type="button" onClick={() => setMode('drug')} className={tabCls(mode === 'drug', 'drug')}>
              <Pill className="w-5 h-5" /> Drug
            </button>
          </div>

          {mode === 'condition' && <ConditionGooglePanel query={label} />}
          {mode === 'drug' && <NewDrugGoogleSearch label={label} />}
        </>
      )}

      <ConditionInsightCard
        searchQuery={label}
        existingDrugs={drugs || []}
        aiExtra={<AiSearchFallback searchQuery={label} />}
      />
    </div>
  );
}
