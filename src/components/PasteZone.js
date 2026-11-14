import React from 'react';
import { imagesFromPasteEvent } from '../utils/clipboardImages';

// A small text box that accepts a long-press → Paste. On phones this is the
// path that receives ALL copied pictures at once (the paste event carries
// every file), unlike the Paste button which can only read what the browser
// exposes through the Async Clipboard API.
export default function PasteZone({ onImages, disabled }) {
  return (
    <textarea
      rows={2}
      value=""
      readOnly={false}
      disabled={disabled}
      onChange={() => {}}
      onPaste={(e) => {
        const blobs = imagesFromPasteEvent(e);
        e.preventDefault();
        e.stopPropagation(); // the card's own paste handler must not run twice
        if (blobs.length > 0) onImages(blobs);
      }}
      placeholder="Paste several: long-press here → Paste"
      className="w-full rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 px-3 py-2 text-sm text-slate-600 placeholder-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
    />
  );
}
