import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Expandable treatment-category section.
export default function ConditionCategoryGroup({ title, count, open, onToggle, children }) {
  return (
    <div className="border border-drug-border rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-bold text-drug-text">{title}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-drug-muted">{count}</span>
          {open ? <ChevronUp className="w-4 h-4 text-drug-muted" /> : <ChevronDown className="w-4 h-4 text-drug-muted" />}
        </span>
      </button>
      {open && <div className="border-t border-drug-border">{children}</div>}
    </div>
  );
}
