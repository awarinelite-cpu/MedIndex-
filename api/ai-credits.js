// api/ai-credits.js
// Node.js serverless function (needs firebase-admin — no `edge` runtime).
//
// GET  → { balance, unlimited } for the signed-in caller. Initializes the
//        wallet with STARTER_CREDITS on first call for a brand-new account.
// POST { action: 'consume', amount? } → atomically deducts credits (default
//        CLINICAL_PLAN_COST) and returns the new balance, or a 402 with the
//        current balance if there isn't enough. Admins are exempt — this
//        route is also called server-to-server from /api/drug-ai-details
//        for the metered clinical_plan mode, forwarding the caller's own
//        Authorization header so the same admin exemption applies there.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  let lib, creditsLib;
  try {
    lib = await import('./_lib/firebaseAdmin.js');
    creditsLib = await import('./_lib/credits.js');
  } catch (e) {
    res.status(500).json({ error: 'Failed to load server modules: ' + (e?.message || String(e)) });
    return;
  }
  const { requireUser } = lib;
  const { ensureWallet, consumeCredits, CLINICAL_PLAN_COST } = creditsLib;

  let caller;
  try {
    caller = await requireUser(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }

  if (req.method === 'GET') {
    if (caller.isAdmin) { res.status(200).json({ balance: null, unlimited: true }); return; }
    try {
      const wallet = await ensureWallet(caller.uid);
      res.status(200).json({ balance: wallet.balance, unlimited: false });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to load wallet.' });
    }
    return;
  }

  if (req.method === 'POST') {
    const { action, amount } = req.body || {};
    if (action !== 'consume') { res.status(400).json({ error: `Unknown action: ${action}` }); return; }

    if (caller.isAdmin) { res.status(200).json({ balance: null, unlimited: true }); return; }

    try {
      const balance = await consumeCredits(caller.uid, amount || CLINICAL_PLAN_COST);
      res.status(200).json({ balance, unlimited: false });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Failed to charge credits.', balance: e.balance });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
