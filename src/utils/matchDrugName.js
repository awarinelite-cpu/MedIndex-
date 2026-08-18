// src/utils/matchDrugName.js — matches an OCR-read drug name (noisy, may
// include brand names, dosage strengths, "Tablets", manufacturer text,
// etc.) against the existing drug list, for the Bulk Image Upload
// "Photos (auto-match)" flow.

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(tablet|tablets|capsule|capsules|injection|syrup|mg|ml|g|iu|solution|suspension)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein edit distance, small strings only (drug names), so an O(n*m)
// implementation is plenty fast.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

/**
 * @param {string} ocrName - raw name read off the photo
 * @param {Array<{id: string, name: string}>} drugList - existing drugs to match against
 * @returns {{ id: string, name: string, score: number, [key: string]: any } | null} best match
 *   (any extra fields on a drugList entry, e.g. displayName, pass through), or null if drugList is empty
 */
export function matchDrugName(ocrName, drugList) {
  const norm = normalize(ocrName);
  if (!norm || drugList.length === 0) return null;

  let best = null;
  for (const drug of drugList) {
    const drugNorm = normalize(drug.name);
    if (!drugNorm) continue;

    let score;
    if (drugNorm === norm) {
      score = 1;
    } else if (norm.includes(drugNorm) || drugNorm.includes(norm)) {
      // Substring match (e.g. OCR caught "paracetamol 500mg gsk" containing
      // the full drug name "paracetamol") — strong signal, scaled by how
      // much of the shorter string the match covers.
      score = 0.75 + 0.2 * (Math.min(drugNorm.length, norm.length) / Math.max(drugNorm.length, norm.length));
    } else {
      score = similarity(norm, drugNorm) * 0.75; // edit-distance fallback, capped below substring tier
    }

    if (!best || score > best.score) {
      best = { ...drug, score };
    }
  }
  return best;
}

// Confidence bands the UI uses to decide auto-confirm vs. needs-review.
export const MATCH_HIGH_CONFIDENCE = 0.82;
export const MATCH_LOW_CONFIDENCE = 0.5; // below this, treat as "no match"
