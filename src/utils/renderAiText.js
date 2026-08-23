import React from 'react';
import { Link } from 'react-router-dom';

// Parse a line for inline **bold** markdown and render <strong> for it.
function renderInlineBold(line, keyPrefix) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={`${keyPrefix}-${i}`} className="font-bold text-drug-text">{part}</strong>
      : <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
  );
}

// Same as renderInlineBold, but wraps the FIRST bold segment in a Link using
// getLinkPath(name). Used for bulleted drug-name lists (e.g. "AI: More in
// class X") so each medication can be opened for its own full breakdown.
function renderInlineBoldWithLink(line, keyPrefix, getLinkPath) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  let linked = false;
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      if (!linked) {
        linked = true;
        const path = getLinkPath(part.trim());
        if (path) {
          return (
            <Link
              key={`${keyPrefix}-${i}`}
              to={path}
              className="font-bold text-primary-700 hover:underline hover:text-primary-800"
            >
              {part}
            </Link>
          );
        }
      }
      return <strong key={`${keyPrefix}-${i}`} className="font-bold text-drug-text">{part}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

// A short "Sub-label:" at the very start of a line (e.g. "Hemorrhagic
// shock: When blood loss is significant…") reads much easier when the
// label is bold — but content saved from AI-generated procedure/drug text
// has already had its ** markers stripped (see parseAiProcedureDetail's
// cleanBody), so there's nothing left in the stored text to bold on. This
// detects that pattern at render time instead, so it works regardless of
// whether the source text ever had markdown in it.
const LEADING_LABEL_RE = /^([^:\n*]{2,60}):\s+(.+)$/s;

function splitLeadingLabel(line) {
  // Skip lines that already carry explicit **bold** markup — that's
  // intentional authoring, and layering auto-detection on top of it risks
  // matching partway into the marked-up text.
  if (line.includes('**')) return null;
  const m = line.match(LEADING_LABEL_RE);
  if (!m) return null;
  const label = m[1].trim();
  // Skip bare numbers/ratios/times ("10:30", "1:2") — not real sub-labels.
  if (/^\d+$/.test(label)) return null;
  return { label, rest: m[2] };
}

// Renders one line with its leading "Label:" (if any) auto-bolded, then
// hands the remainder off to the normal inline-bold (and optional link)
// rendering for any further ** markup within it.
function renderLineWithAutoLabel(line, keyPrefix, getLinkPath) {
  const split = splitLeadingLabel(line);
  if (!split) {
    return getLinkPath ? renderInlineBoldWithLink(line, keyPrefix, getLinkPath) : renderInlineBold(line, keyPrefix);
  }
  const { label, rest } = split;
  return (
    <>
      <strong key={`${keyPrefix}-label`} className="font-bold text-drug-text">{label}:</strong>{' '}
      {getLinkPath ? renderInlineBoldWithLink(rest, keyPrefix, getLinkPath) : renderInlineBold(rest, keyPrefix)}
    </>
  );
}

// Simple renderer for AI responses formatted with markdown headers, - bullets,
// and inline **bold** sub-labels.
// Pass opts.getLinkPath(drugName) => path to make the first bolded term in
// each bullet line (typically a drug's generic name) a clickable Link.
export function renderAiText(text, opts = {}) {
  if (!text) return null;
  const { getLinkPath } = opts;
  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  return blocks.map((block, i) => {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    const body = headerMatch ? block.replace(/^#{1,6}\s+.+\n?/, '') : block;
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !/^(-{3,}|\*{3,})$/.test(l));
    return (
      <div key={i} className="mb-6 last:mb-0">
        {headerMatch && (
          <h3 className="text-base font-bold text-drug-text mb-2">
            {renderInlineBold(headerMatch[1], `h-${i}`)}
          </h3>
        )}
        <div className="space-y-1.5">
          {lines.map((line, j) => {
            if (/^[-*]\s+/.test(line)) {
              const bulletText = line.replace(/^[-*]\s+/, '');
              return (
                <div key={j} className="flex items-start gap-2 text-sm text-drug-text leading-relaxed">
                  <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
                  <span>
                    {renderLineWithAutoLabel(bulletText, `b-${i}-${j}`, getLinkPath)}
                  </span>
                </div>
              );
            }
            return (
              <p key={j} className="text-sm text-drug-text leading-relaxed">
                {renderLineWithAutoLabel(line, `p-${i}-${j}`, getLinkPath)}
              </p>
            );
          })}
        </div>
      </div>
    );
  });
}
