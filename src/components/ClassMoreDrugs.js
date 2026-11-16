// src/components/ClassMoreDrugs.js
//
// "Find more drugs" dropdown for a drug class or subclass page section.
// Collapsed by default. Opening it reveals the AI panel (missing-info banner
// plus "Ask AI for more"). A Google search button for the same class sits
// directly below the dropdown, always visible.
import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Search } from 'lucide-react';
import AiClassInsight from './AiClassInsight';

export default function ClassMoreDrugs({
  className, existingDrugs, databaseDrugs, parentClassName, classId, subclassId, subclasses,
}) {
  const [open, setOpen] = useState(false);
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${parentClassName ? `${className} (${parentClassName})` : className} drugs list Nigeria`
  )}`;

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-2xl border border-primary-200 bg-primary-50/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-primary-700"
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 min-w-0 truncate">Find more drugs with AI</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {open && (
          <div className="px-3 pb-3">
            <AiClassInsight
              className={className}
              existingDrugs={existingDrugs}
              parentClassName={parentClassName}
              databaseDrugs={databaseDrugs}
              classId={classId}
              subclassId={subclassId}
              subclasses={subclasses}
            />
          </div>
        )}
      </div>

      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-2xl border border-drug-border bg-white px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
      >
        <Search className="w-4 h-4" /> Search Google for more drugs in this class
      </a>
    </div>
  );
}
