import React from 'react';
import { ChevronRight } from 'lucide-react';

// Expandable treatment-category section: numbered badge, name, count pill, chevron.
export default function ConditionCategoryGroup({ index, title, count, open, onToggle, children }) {
  return (
    <div className="rounded-[26px] overflow-hidden border border-[#C9DCFB] bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
        style={{ background: 'linear-gradient(180deg, #FFFFFF, #EAF2FF)' }}
      >
        {index != null && (
          <span className="w-8 h-8 rounded-full bg-blue-700 text-white text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">
            {index}
          </span>
        )}
        <span className="flex-1 min-w-0 text-[18px] leading-snug font-bold text-[#0A1F5C]">{title}</span>
        <span className="min-w-[34px] text-center px-3 py-1 rounded-full bg-[#D6E6FF] text-blue-700 text-[15px] font-extrabold flex-shrink-0">
          {count}
        </span>
        <ChevronRight className={`w-5 h-5 text-[#0A1F5C] flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="border-t border-[#C9DCFB]">{children}</div>}
    </div>
  );
}
