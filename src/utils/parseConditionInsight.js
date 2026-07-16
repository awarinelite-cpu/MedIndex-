// Splits the markdown produced by the 'condition_insight' AI mode into its
// three narrative sections. The trailing "## Medications" section is left
// for parseAiDrugList to handle separately — it already skips any block
// without "- **Name**" bullets, so feeding it the whole text is also safe.
export function parseConditionInsight(text) {
  const result = { overview: '', etiology: '', pathophysiology: '' };
  if (!text) return result;

  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  for (const block of blocks) {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim().toLowerCase();
    const body = block.replace(/^#{1,6}\s+.+\n?/, '').trim();
    if (header === 'overview') result.overview = body;
    else if (header === 'etiology') result.etiology = body;
    else if (header === 'pathophysiology') result.pathophysiology = body;
  }
  return result;
}

// Mirrors the "Not a recognized clinical condition." refusal line the
// condition_insight prompt is instructed to reply with when the searched
// term isn't a real clinical condition/indication.
export function isNotAConditionText(text) {
  if (!text || !text.trim()) return false;
  return /not a recognized clinical condition/i.test(text.slice(0, 200));
}
