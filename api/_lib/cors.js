// api/_lib/cors.js
//
// Shared CORS wrapper for the Edge Function API routes. The web build is
// served from this same Vercel deployment, so same-origin requests never
// needed CORS headers before. The Capacitor native build changes that: the
// WebView serves the app from a local scheme (https://localhost on
// Android, capacitor://localhost on iOS), so every request to these
// routes is now cross-origin and gets blocked by the browser's
// same-origin policy unless the response explicitly allows it.
//
// Usage:
//   async function coreHandler(req) { ... }
//   export default withCors(coreHandler);

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function withCors(coreHandler) {
  return async function handler(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const res = await coreHandler(req);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
