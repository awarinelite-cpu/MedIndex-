// True when `query` is exactly the label of a condition already in the system
// (built-in or admin-added, not hidden). Same exact-match rule the Condition
// Insight card uses for "existingMatch".
import { useMemo } from 'react';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { useCustomConditions, normalizeConditionLabel } from './useCustomConditions';

export function useExistingConditionMatch(query) {
  const { customConditionsBySystem, hiddenConditionIdsBySystem } = useCustomConditions();
  return useMemo(() => {
    const q = normalizeConditionLabel(query);
    if (!q) return null;
    for (const system of ANATOMICAL_SYSTEMS) {
      const hidden = new Set(hiddenConditionIdsBySystem[system.id] || []);
      const all = [...(SYSTEM_CONDITIONS[system.id] || []), ...(customConditionsBySystem[system.id] || [])];
      const hit = all.find(c => !hidden.has(c.id) && normalizeConditionLabel(c.label) === q);
      if (hit) return { ...hit, systemId: system.id, systemName: system.name };
    }
    return null;
  }, [query, customConditionsBySystem, hiddenConditionIdsBySystem]);
}
