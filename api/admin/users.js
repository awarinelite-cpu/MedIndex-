// ── /api/admin/users ──────────────────────────────────────────────────────
// Node.js serverless function (needs firebase-admin, so no `edge` runtime).
// GET  → list every Firebase Auth user (email, name, status, sign-in info)
// POST → { action: 'disable' | 'enable' | 'delete', uid } on one user
//
// Every request must carry the calling admin's Firebase ID token as
// `Authorization: Bearer <token>` — verified server-side against the
// `admins` Firestore collection before anything else runs.
//
// CACHING: Firebase Auth listUsers() is subject to a hard quota (~1 req/s).
// We cache the result in the Vercel function's module-level memory for 60s
// so repeated page loads and refreshes don't burn through the quota.
// Cache is busted after any disable/enable/delete action so the list stays
// accurate after mutations.
// ──────────────────────────────────────────────────────────────────────────

// Module-level cache shared across warm function invocations in the same
// Vercel container. Cold starts get a fresh cache automatically.
let _cache = null;       // { users: [...], nextPageToken: null, ts: Date.now() }
const CACHE_TTL_MS = 60_000; // 60 seconds

function isCacheValid() {
  return _cache && (Date.now() - _cache.ts < CACHE_TTL_MS);
}
function bustCache() {
  _cache = null;
}

export default async function handler(req, res) {
  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    let firebaseAdmin;
    try {
      firebaseAdmin = await import('../_lib/firebaseAdmin.js');
    } catch (e) {
      res.status(500).json({ error: 'Failed to load the Admin SDK module: ' + (e?.message || String(e)) });
      return;
    }
    const { adminAuth, requireAdmin } = firebaseAdmin;

    let caller;
    try {
      caller = await requireAdmin(req);
    } catch (e) {
      res.status(e.status || 401).json({ error: e.message });
      return;
    }

    // ── GET: list users ────────────────────────────────────────────────────
    if (req.method === 'GET') {
      // Return cached result if still fresh
      if (isCacheValid()) {
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json({ users: _cache.users, nextPageToken: _cache.nextPageToken, cached: true });
        return;
      }

      try {
        // Fetch up to 500 users (safer than 1000 for quota headroom)
        const result = await adminAuth().listUsers(500);
        const users = result.users.map(u => ({
          uid:           u.uid,
          email:         u.email || '',
          displayName:   u.displayName || '',
          disabled:      u.disabled,
          emailVerified: u.emailVerified,
          createdAt:     u.metadata.creationTime || null,
          lastSignInAt:  u.metadata.lastSignInTime || null,
          providers:     (u.providerData || []).map(p => p.providerId),
        }));

        // Store in module-level cache
        _cache = { users, nextPageToken: result.pageToken || null, ts: Date.now() };

        res.setHeader('X-Cache', 'MISS');
        res.status(200).json({ users, nextPageToken: result.pageToken || null });
      } catch (e) {
        // Surface quota errors with a clear, actionable message instead of
        // the raw gRPC "8 RESOURCE_EXHAUSTED" string
        const msg = e?.message || '';
        const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || e?.code === 8;
        if (isQuota) {
          res.status(429).json({
            error: 'Firebase Auth quota exceeded — the user list can only be fetched ~1 time per second. Please wait 60 seconds and try again.',
            retryAfterSeconds: 60,
          });
          return;
        }
        throw e; // re-throw non-quota errors to the outer catch
      }
      return;
    }

    // ── POST: mutate one user ──────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action, uid } = req.body || {};
      if (!uid)    { res.status(400).json({ error: 'Missing uid.' }); return; }
      if (!action) { res.status(400).json({ error: 'Missing action.' }); return; }

      if (uid === caller.uid && (action === 'disable' || action === 'delete')) {
        res.status(400).json({ error: "You can't disable or delete your own admin account from here." });
        return;
      }

      if (action === 'disable')      await adminAuth().updateUser(uid, { disabled: true });
      else if (action === 'enable')  await adminAuth().updateUser(uid, { disabled: false });
      else if (action === 'delete')  await adminAuth().deleteUser(uid);
      else { res.status(400).json({ error: `Unknown action: ${action}` }); return; }

      // Bust the cache so the next GET reflects the mutation
      bustCache();

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    res.status(500).json({
      error: e?.message || 'Unknown server error.',
      stack: e?.stack?.split('\n').slice(0, 3),
    });
  }
}
