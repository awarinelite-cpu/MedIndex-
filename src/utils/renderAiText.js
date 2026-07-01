import React from 'react';

// Parse a line for inline **bold** markdown and render <strong> for it.
function renderInlineBold(line, keyPrefix) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={`${keyPrefix}-${i}`} className="font-bold text-drug-text">{part}</strong>
      : <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
  );
}

// Simple renderer for AI responses formatted with ## headers, - bullets,
// and inline **bold** sub-labels.
export function renderAiText(text) {
  if (!text) return null;
  const blocks = text.split(/\n(?=##\s)/g);
  return blocks.map((block, i) => {
    const headerMatch = block.match(/^##\s+(.+)/);
    const body = headerMatch ? block.replace(/^##\s+.+\n?/, '') : block;
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
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
              return (
                <div key={j} className="flex items-start gap-2 text-sm text-drug-text leading-relaxed">
                  <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
                  <span>{renderInlineBold(line.replace(/^[-*]\s+/, ''), `b-${i}-${j}`)}</span>
                </div>
              );
            }
            return (
              <p key={j} className="text-sm text-drug-text leading-relaxed">
                {renderInlineBold(line, `p-${i}-${j}`)}
              </p>
            );
          })}
        </div>
      </div>
    );
  });
}
