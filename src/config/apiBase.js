// src/config/apiBase.js
//
// The web build is served from the same Vercel deployment as the /api/*
// serverless functions, so relative fetch('/api/...') calls just work.
// The Capacitor native build has no server of its own: the WebView loads
// the app from a local scheme (https://localhost on Android,
// capacitor://localhost on iOS), so a relative '/api/...' request would
// try to hit the device instead of Vercel. apiUrl() rewrites those calls
// to the live Vercel deployment when running inside the native app, and
// leaves them untouched everywhere else (browser, PWA).

import { Capacitor } from '@capacitor/core';

// Live production deployment that hosts the /api/* functions.
export const PRODUCTION_API_BASE = 'https://med-index-six.vercel.app';

export function apiUrl(path) {
  if (Capacitor.isNativePlatform() && path.startsWith('/')) {
    return `${PRODUCTION_API_BASE}${path}`;
  }
  return path;
}
