import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { THERAPY_ROLE_META } from '../../utils/drugRoleClassification';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Combination regimen card — visually distinct from single-drug rows.
// Each component links to its existing drug page when a matching drug record
// exists; otherwise it is shown as plain text (no new records are created).
export default function ConditionRegimenCard({ regimen, drugIndex, trailing }) {
  const meta = THERAPY_ROLE_META.combination;
  const components = (Array.isArray(regimen.combination_components) ? regimen.combination_components : [])
    .map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
  const description = regimen.indications || regimen.overview || '';

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid ' + meta.border, background: meta.bg }}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="font-bold text-sm" style={{ color: meta.color }}>{regimen.generic_name}</div>
          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color, opacity: 0.8 }}>
            Combination regimen
          </span>
        </div>
        {trailing}
      </div>

      {components.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          {components.map((name, i) => {
            const match = drugIndex.get(norm(name));
            return (
              <React.Fragment key={name + i}>
                {i > 0 && <span className="text-xs font-bold" style={{ color: meta.color }}>+</span>}
                {match ? (
                  <Link
                    to={`/drug/${match.id}`}
                    className="text-xs font-semibold px-2 py-1 rounded-lg bg-white hover:underline"
                    style={{ color: meta.color, border: '1px solid ' + meta.border }}
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/70 text-drug-text" style={{ border: '1px solid ' + meta.border }}>
                    {name}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {description && <p className="px-4 pt-2 text-xs text-drug-muted line-clamp-3">{description}</p>}

      <Link
        to={`/drug/${regimen.id}`}
        className="flex items-center justify-end gap-1 px-4 py-2.5 text-xs font-semibold hover:underline"
        style={{ color: meta.color }}
      >
        View regimen <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
