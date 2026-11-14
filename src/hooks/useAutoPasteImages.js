// src/hooks/useAutoPasteImages.js
//
// "Auto-paste" for copied pictures. While switched on, the clipboard is checked
// every couple of seconds and again the moment the app regains focus (e.g. you
// copy a picture in the browser and switch back). Any picture that is NEW since
// the last check is handed to `onImages` — no Paste button needed.
//
// Safeguards:
//  • Opt-in only, and never persisted — it switches itself off when the screen
//    is closed, so it can't upload pictures to the wrong drug later.
//  • Whatever is already on the clipboard when you switch it on is ignored.
//  • Each picture is recognised by a content fingerprint, so the same copied
//    picture is never uploaded twice.
//  • Waits while an upload is running.
//
// Needs the browser's Async Clipboard API (same one the Paste button uses). The
// first switch-on is a tap, which lets the browser ask for clipboard permission.

import { useState, useEffect, useRef, useCallback } from 'react';
import { imagesFromClipboardApi } from '../utils/clipboardImages';

// Cheap content fingerprint: type + size + a hash of ~512 sampled bytes.
async function fingerprint(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const step = Math.max(1, Math.floor(bytes.length / 512));
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${blob.type}-${blob.size}-${h}`;
}

// 'denied' = the user/browser refused clipboard access; anything else (no image
// on the clipboard, document not focused yet, ...) is a normal "nothing to do".
function classifyError(err) {
  if (err?.name === 'NotAllowedError' && !/focus/i.test(err.message || '')) return 'denied';
  return 'ignore';
}

export default function useAutoPasteImages({ onImages, busy = false, intervalMs = 2000 }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('off'); // off | watching | denied | unsupported
  const seen = useRef(new Set());
  const inFlight = useRef(false);
  const onImagesRef = useRef(onImages);
  const busyRef = useRef(busy);

  useEffect(() => {
    onImagesRef.current = onImages;
    busyRef.current = busy;
  });

  // One check of the clipboard. `markOnly` records what's there without
  // uploading it (used as the baseline when switching on).
  // Returns false only if clipboard access was denied.
  const check = useCallback(async ({ markOnly = false, force = false } = {}) => {
    if (inFlight.current) return true;
    if (!force) {
      if (busyRef.current) return true;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return true;
    }
    inFlight.current = true;
    try {
      // iOS shows a "Paste" bubble and waits for a tap; don't hang forever.
      const blobs = await Promise.race([
        imagesFromClipboardApi(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('clipboard timeout')), 8000)),
      ]);
      const fresh = [];
      for (const b of blobs) {
        const sig = await fingerprint(b);
        if (!seen.current.has(sig)) {
          seen.current.add(sig);
          fresh.push(b);
        }
      }
      if (!markOnly && fresh.length > 0) await onImagesRef.current(fresh);
      return true;
    } catch (err) {
      return classifyError(err) !== 'denied';
    } finally {
      inFlight.current = false;
    }
  }, []);

  const enable = useCallback(async () => {
    if (!navigator.clipboard?.read) {
      setStatus('unsupported');
      return;
    }
    seen.current = new Set();
    // Switch on immediately so the button reflects the tap. The baseline read
    // (which may show a permission prompt) happens in the background; the
    // in-flight guard stops the poller from uploading old clipboard content.
    setEnabled(true);
    setStatus('watching');
    const ok = await check({ markOnly: true, force: true });
    if (!ok) {
      setEnabled(false);
      setStatus('denied');
    }
  }, [check]);

  const disable = useCallback(() => {
    setEnabled(false);
    setStatus('off');
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const run = async () => {
      const ok = await check();
      if (!ok) {
        setEnabled(false);
        setStatus('denied');
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };

    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    // iOS shows a "Paste" bubble on every clipboard read, so polling there is
    // disruptive; rely on focus/visibility events instead.
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const timer = isIOS ? null : setInterval(run, intervalMs);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
    };
  }, [enabled, check, intervalMs]);

  return { enabled, status, enable, disable };
}
