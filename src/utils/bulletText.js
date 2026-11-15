// Shared helpers: turn free text into bullet items and keep them justified.
const SPLIT_RE = /\n+|\|+|(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\bvs\.)(?<!\bDr\.)(?<!\bapprox\.)(?<!\bNo\.)(?<!\betc\.)(?<=[.!?])\s+(?=[A-Z0-9(])/;

export function splitIntoBullets(value) {
  if (!value) return [];
  return String(value)
    .replace(/\r/g, '')
    .split(SPLIT_RE)
    .map(s => s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

export const justifyStyle = { textAlign: 'justify', hyphens: 'auto', WebkitHyphens: 'auto' };
