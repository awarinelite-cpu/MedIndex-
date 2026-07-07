// ── /api/admin/users ──────────────────────────────────────────────────────
// Node.js serverless function (needs firebase-admin, so no `edge` runtime).
// GET  → list every Firebase Auth user (email, name, status, sign-in info)
// POST → { action: 'disable' | 'enable' | 'delete', uid } on one user
//
// Every request must carry the calling admin's Firebase ID token as
// `Authorization: Bearer <token>` — verified server-side against the
// `admins` Firestore collection before anything else runs.
// ──────────────────────────────────────────────────────────────────────────

import { adminAuth, requireAdmin } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  let caller;
  try {
    caller = await requireAdmin(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }

  try {
    if (req.method === 'GET') {
      const pageToken = typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined;
      const result = await adminAuth().listUsers(1000, pageToken);
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
      res.status(200).json({ users, nextPageToken: result.pageToken || null });
      return;
    }

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

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error.' });
  }
}
