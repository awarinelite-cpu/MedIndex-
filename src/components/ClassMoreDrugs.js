// src/components/ClassMoreDrugs.js
//
// "Find more drugs" dropdown for a drug class or subclass page section.
// Collapsed by default. Opening it reveals the AI panel (missing-info banner
// plus "Ask AI for more"). A Google search button for the same class sits
// directly below the dropdown, always visible, with an admin paste box for
// the CSV Google returns.
import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import AiClassInsight from './AiClassInsight';
import ClassGoogleEntry from './ClassGoogleEntry';

export default function ClassMoreDrugs({
  className, existingDrugs, databaseDrugs, parentClassName, classId, subclassId, subclasses,
}) {
  const [open, setOpen] = useState(false);
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

      <ClassGoogleEntry
        className={className}
        parentClassName={parentClassName}
        classId={classId}
        subclassId={subclassId}
        subclasses={subclasses}
        databaseDrugs={databaseDrugs}
      />
    </div>
  );
}
