// Parses the markdown produced by the "class" mode of /api/drug-ai-details
// (heading lines + "- **Name** — note" bullets) into structured rows:
// [{ name, subclass, note }, ...]. Used to render AI-suggested drugs as
// clickable list rows matching the app's normal browse-list styling.
export function parseAiDrugList(text) {
  if (!text) return [];
  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  const items = [];

  for (const block of blocks) {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    const subclass = headerMatch ? headerMatch[1].trim() : '';
    const body = headerMatch ? block.replace(/^#{1,6}\s+.+\n?/, '') : block;
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[—–\-:]?\s*(.*)$/);
      if (m) {
        const name = m[1].trim();
        const note = m[2].trim();
        if (name) items.push({ name, subclass, note });
      }
    }
  }

  return items;
}
