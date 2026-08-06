// src/hooks/usePwaInstall.js
// Tracks the browser's beforeinstallprompt event so any component can offer
// an "Install app" button. Extracted from Layout.js so it can be shared with
// pages like MorePage.js.

import { useState, useEffect } from 'react';

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [isInstalled,   setIsInstalled]   = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
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
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

  const dismissInstall = () => setShowInstall(false);

  return { showInstall, isInstalled, handleInstall, dismissInstall };
}
