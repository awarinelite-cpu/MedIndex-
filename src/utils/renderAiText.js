import React from 'react';

// Simple renderer for AI responses formatted with ## headers and - bullets.
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
          <h3 className="text-base font-bold text-drug-text mb-2">{headerMatch[1]}</h3>
        )}
        <div className="space-y-1.5">
          {lines.map((line, j) => {
            if (/^[-*]\s+/.test(line)) {
              return (
                <div key={j} className="flex items-start gap-2 text-sm text-drug-text leading-relaxed">
                  <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
                  <span>{line.replace(/^[-*]\s+/, '')}</span>
                </div>
              );
            }
            return (
              <p key={j} className="text-sm text-drug-text leading-relaxed">{line}</p>
            );
          })}
        </div>
      </div>
    );
  });
}
