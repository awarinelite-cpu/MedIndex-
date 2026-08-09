// api/paystack-verify.js
// Node.js serverless function (needs firebase-admin — no `edge` runtime).
//
// POST { reference } — called by the client immediately after Paystack
// Inline reports a successful charge. Verifies the transaction directly
// with Paystack's server-side API (never trusts the client's word for it),
// then credits the wallet. Idempotent — see api/_lib/credits.js — so it's
// harmless if the webhook (api/paystack-webhook.js) processes the same
// reference first or afterwards.
//
// Requires PAYSTACK_SECRET_KEY set in Vercel project settings.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Server is not configured with PAYSTACK_SECRET_KEY.' });
    return;
  }

  let lib, creditsLib;
  try {
    lib = await import('./_lib/firebaseAdmin.js');
    creditsLib = await import('./_lib/credits.js');
  } catch (e) {
    res.status(500).json({ error: 'Failed to load server modules: ' + (e?.message || String(e)) });
    return;
  }
  const { requireUser } = lib;
  const { creditPurchase, CREDIT_PACKAGES } = creditsLib;

  let caller;
  try {
    caller = await requireUser(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }

  const { reference } = req.body || {};
  if (!reference || typeof reference !== 'string') {
    res.status(400).json({ error: 'reference is required.' });
    return;
  }

  let payload;
  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    payload = await verifyRes.json();
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Paystack to verify this payment. Try again in a moment.' });
    return;
  }

  const tx = payload?.data;
  if (!payload?.status || !tx || tx.status !== 'success') {
    res.status(400).json({ error: 'Payment was not successful — nothing was credited.' });
    return;
  }

  // The transaction must belong to the signed-in caller — checked against
  // the uid embedded in metadata when the client initialized the charge,
  // not just email, since email can change.
  if (tx.metadata?.uid && tx.metadata.uid !== caller.uid) {
    res.status(403).json({ error: 'This payment reference does not belong to your account.' });
    return;
  }

  const amountNaira = Math.round((tx.amount || 0) / 100);
  if (!CREDIT_PACKAGES[amountNaira]) {
    res.status(400).json({ error: `₦${amountNaira} does not match any AI credit package.` });
    return;
  }

  try {
    const result = await creditPurchase({ uid: caller.uid, reference, amountNaira, source: 'verify' });
    res.status(200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to credit your account.' });
  }
}
