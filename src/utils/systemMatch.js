// Given a drug and a system definition (from anatomicalSystems.js), returns
// true if the drug's class or subclass matches any of that system's
// keywords. Case-insensitive substring match — deliberately loose, since
// drug_class naming isn't perfectly standardized across entries (some are
// AI-generated, some are CSV-imported).
export function drugMatchesSystem(drug, system) {
  const haystack = `${drug.drug_class || ''} ${drug.drug_subclass || ''}`.toLowerCase();
  return system.keywords.some(kw => haystack.includes(kw.toLowerCase()));
}

// Returns every drug in allDrugs that matches the given system.
export function getDrugsForSystem(allDrugs, system) {
  return allDrugs.filter(drug => drugMatchesSystem(drug, system));
}

// Returns { systemId: count } for every system, given a drug list — used to
// show counts on the "More Systems" index without recomputing per-card.
export function getSystemCounts(allDrugs, systems) {
  const counts = {};
  for (const system of systems) {
    counts[system.id] = getDrugsForSystem(allDrugs, system).length;
  }
  return counts;
}
