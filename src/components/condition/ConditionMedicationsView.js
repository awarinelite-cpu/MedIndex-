import React, { useMemo, useState } from 'react';
import { Pill } from 'lucide-react';
import { getDisplayDrugClass } from '../../utils/drugCategory';
import { TREATMENT_CATEGORY_ORDER, getTreatmentCategory } from '../../utils/drugRoleClassification';
import ConditionCategoryGroup from './ConditionCategoryGroup';
import ConditionDrugRow from './ConditionDrugRow';
import ConditionRegimenCard from './ConditionRegimenCard';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const OTHER = 'Other relevant treatments';

// "Medications used for this condition": individual drugs grouped by treatment
// category (expandable), then a separate Combination regimens section.
// Uses the condition's existing drug list and role buckets — nothing is
// created or migrated.
export default function ConditionMedicationsView({ roleBuckets, allDrugs, renderTrailing, adminNoteFor }) {
  const [openCats, setOpenCats] = useState(() => new Set());

  const groups = useMemo(() => {
    const map = new Map();
    const add = (drug, role) => {
      const cat = getTreatmentCategory(drug) || (getDisplayDrugClass(drug) || '').trim() || OTHER;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ drug, role });
    };
    roleBuckets.main.forEach(d => add(d, 'main'));
    roleBuckets.adjunct.forEach(d => add(d, 'adjunct'));
    const rank = (c) => { const i = TREATMENT_CATEGORY_ORDER.indexOf(c); return i === -1 ? 1000 : i; };
    return [...map.entries()]
      .map(([cat, items]) => [cat, items.sort((a, b) =>
        (a.role === b.role ? 0 : a.role === 'main' ? -1 : 1) ||
        (a.drug.generic_name || '').localeCompare(b.drug.generic_name || '', 'en', { sensitivity: 'base' }))])
      .sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[0] === OTHER) - (b[0] === OTHER) || a[0].localeCompare(b[0]));
  }, [roleBuckets]);

  const drugIndex = useMemo(() => {
    const m = new Map();
    (allDrugs || []).forEach(d => { if (d?.generic_name && !d.is_combination_therapy) m.set(norm(d.generic_name), d); });
    return m;
  }, [allDrugs]);

  const regimens = roleBuckets.combination || [];
  const singleCount = groups.reduce((n, [, items]) => n + items.length, 0);
  const toggle = (cat) => setOpenCats(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-start gap-3">
        <Pill className="w-8 h-8 text-blue-600 flex-shrink-0 -rotate-45 mt-0.5" />
        <div>
          <h3 className="text-[19px] leading-tight font-extrabold text-[#0A1F5C]">Medications used for this condition</h3>
          <p className="text-[15px] text-slate-600 mt-0.5">
            Organised by treatment category • {singleCount} medication{singleCount !== 1 ? 's' : ''}
            {regimens.length > 0 ? ` • ${regimens.length} regimen${regimens.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="space-y-2.5">
          {groups.map(([cat, items], gi) => (
            <ConditionCategoryGroup
              key={cat}
              index={gi + 1}
              title={cat}
              count={items.length}
              open={groups.length === 1 || openCats.has(cat)}
              onToggle={() => toggle(cat)}
            >
              {items.map(({ drug, role }, i) => (
                <ConditionDrugRow
                  key={drug.id}
                  drug={drug}
                  role={role}
                  drugClass={drug.drug_subclass || getDisplayDrugClass(drug)}
                  brand={(drug.brand_names || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 2).join(', ')}
                  adminNote={adminNoteFor ? adminNoteFor(drug) : null}
                  trailing={renderTrailing(drug)}
                  last={i === items.length - 1}
                />
              ))}
            </ConditionCategoryGroup>
          ))}
        </div>
      )}

      {regimens.length > 0 && (
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: '#065F46' }}>
            Combination regimens
          </div>
          <div className="space-y-2.5">
            {regimens.map(r => (
              <ConditionRegimenCard key={r.id} regimen={r} drugIndex={drugIndex} trailing={renderTrailing(r)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
