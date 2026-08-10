// src/components/IosInstallModal.js
// Safari (and every other iOS browser — all WebKit under the hood) has no
// beforeinstallprompt equivalent, so there's nothing to trigger
// programmatically. This walks the user through the manual Share → Add to
// Home Screen steps instead. Shown from usePwaInstall()'s
// showIosInstructions state wherever the Install button/banner lives.

import React from 'react';
import { X, Share, PlusSquare, Pill } from 'lucide-react';

export default function IosInstallModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-drug-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary-900 rounded-lg">
              <Pill className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-drug-text">Install MedIndex</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-drug-muted" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-drug-muted">
            Safari doesn't let apps install themselves — add MedIndex to your Home Screen in a few taps:
          </p>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">1</div>
            <div className="flex-1 text-sm text-drug-text pt-0.5">
              Tap the <Share className="w-4 h-4 inline mx-1 -mt-0.5 text-primary-600" /> <strong>Share</strong> icon in Safari's toolbar
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">2</div>
            <div className="flex-1 text-sm text-drug-text pt-0.5">
              Scroll down and tap <PlusSquare className="w-4 h-4 inline mx-1 -mt-0.5 text-primary-600" /> <strong>Add to Home Screen</strong>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">3</div>
            <div className="flex-1 text-sm text-drug-text pt-0.5">
              Tap <strong>Add</strong> in the top right corner
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
