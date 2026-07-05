// Parses the markdown produced by the "system_conditions" mode of
// /api/drug-ai-details — blocks of:
//   ### Condition Label
//   Icon: 🫀
//   Keywords: keyword one, keyword two, keyword three
// into [{ label, icon, keywords: [] }, ...].
export function parseAiConditionList(text) {
  if (!text) return [];
  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  const items = [];

  for (const block of blocks) {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    if (!headerMatch) continue;
    const label = headerMatch[1].trim();
    if (!label) continue;

    const iconMatch = block.match(/^\s*Icon:\s*(.+)$/mi);
    const keywordsMatch = block.match(/^\s*Keywords:\s*(.+)$/mi);

    const icon = iconMatch ? iconMatch[1].trim().split(/\s+/)[0] : '💊';
    const keywords = keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : [];

    if (keywords.length > 0) items.push({ label, icon, keywords });
  }

  return items;
}
