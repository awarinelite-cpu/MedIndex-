// src/hooks/usePwaInstall.js
// Tracks install-ability across both install paths the app supports:
//   - Chrome/Edge/Android (and desktop Chromium): the standard
//     `beforeinstallprompt` event, which can be triggered programmatically.
//   - Safari/iOS (and any other iOS browser — they're all WebKit under the
//     hood, so none of them fire beforeinstallprompt): there is no install
//     API at all. The only way to install is the user manually tapping
//     Share → Add to Home Screen, so this hook surfaces `platform: 'ios'`
//     and callers show instructions instead of a button that does nothing.
//
// showInstall stays true (until actually installed) on every load — there
// is deliberately no "dismissed forever" flag written to storage, so the
// prompt keeps appearing on return visits until the user installs the app.

import { useState, useEffect } from 'react';

function detectIOS() {
  const ua = window.navigator.userAgent;
  // Classic iPhone/iPod/iPad UA sniff, plus the iPadOS 13+ case where Safari
  // reports itself as a Mac but is actually a touch device.
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isIpadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIpadOS13Plus;
}

function detectStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [isInstalled,   setIsInstalled]   = useState(false);
  // 'chrome' → native beforeinstallprompt is available; 'ios' → show manual
  // Add to Home Screen instructions instead; null → neither (yet, or an
  // unsupported/already-installed context).
  const [platform, setPlatform] = useState(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (detectStandalone()) {
      setIsInstalled(true);
      return;
    }

    // iOS gets no install event to wait for — we already know up front
    // whether Add to Home Screen instructions are the only option here.
    if (detectIOS()) {
      setPlatform('ios');
      setShowInstall(true);
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setPlatform('chrome');
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setShowInstall(false);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIosInstructions(true);
      return;
    }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

  // Deliberately does NOT persist a "don't show again" flag — hiding the
  // banner only lasts for the current page view, by design, so it comes
  // back on the next visit/reload until the app is actually installed.
  const dismissInstall = () => setShowInstall(false);
  const closeIosInstructions = () => setShowIosInstructions(false);

  return {
    showInstall, isInstalled, platform,
    handleInstall, dismissInstall,
    showIosInstructions, closeIosInstructions,
  };
}
