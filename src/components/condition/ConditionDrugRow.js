import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { THERAPY_ROLE_META } from '../../utils/drugRoleClassification';

// Compact medication row for the Condition Profile. Opens the existing
// drug details page (/drug/:id). `trailing` carries the existing actions
// (favourite heart, Rx badge, admin remove) passed in by ConditionSection.
export default function ConditionDrugRow({ drug, drugClass, role, brand, adminNote, trailing, last }) {
  const meta = role ? THERAPY_ROLE_META[role] : null;
  return (
    <Link
      to={`/drug/${drug.id}`}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${last ? '' : 'border-b border-drug-border/70'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-drug-text">{drug.generic_name}</span>
          {meta && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ color: meta.color, background: meta.bg, border: '1px solid ' + meta.border }}
            >
              {role === 'main' ? 'Main indicated' : 'Adjunct'}
            </span>
          )}
        </div>
        <div className="text-xs text-primary-600 truncate">{drugClass}</div>
        {brand && <div className="text-[11px] text-drug-muted truncate">Brand: {brand}</div>}
        {adminNote && <div className="text-[11px] text-drug-muted truncate">{adminNote}</div>}
      </div>
      {trailing}
      <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
    </Link>
  );
}
