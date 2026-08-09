// api/paystack-webhook.js
// Node.js serverless function. Paystack calls this directly (configure the
// URL in the Paystack dashboard: Settings → API Keys & Webhooks) whenever
// a transaction event happens. This is the reliable backstop for
// api/paystack-verify.js — if a user pays and closes the tab/app before
// the client-side verify call fires, this still credits the wallet.
//
// Requires PAYSTACK_SECRET_KEY set in Vercel project settings (same key
// used to verify transactions is also used to verify this webhook's
// signature).

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Server is not configured with PAYSTACK_SECRET_KEY.' });
    return;
  }

  const rawBody = await readRawBody(req);

  // Verify this really came from Paystack before trusting anything in it.
  let crypto;
  try {
    crypto = await import('node:crypto');
  } catch (e) {
    res.status(500).json({ error: 'Server crypto module unavailable.' });
    return;
  }
  const expectedSignature = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const signature = req.headers['x-paystack-signature'];
  if (!signature || signature !== expectedSignature) {
    res.status(401).json({ error: 'Invalid signature.' });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }

  // Acknowledge fast — Paystack retries on non-2xx / slow responses. Any
  // event that isn't a successful charge is simply ignored.
  if (event?.event !== 'charge.success') {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const tx = event.data || {};
  const uid = tx.metadata?.uid;
  const reference = tx.reference;
  const amountNaira = Math.round((tx.amount || 0) / 100);

  if (!uid || !reference) {
    // Nothing usable to credit — still 200 so Paystack doesn't retry forever.
    res.status(200).json({ ok: true, skipped: 'missing uid or reference' });
    return;
  }

  try {
    const { creditPurchase, CREDIT_PACKAGES } = await import('./_lib/credits.js');
    if (!CREDIT_PACKAGES[amountNaira]) {
      res.status(200).json({ ok: true, skipped: `no package for ₦${amountNaira}` });
      return;
    }
    await creditPurchase({ uid, reference, amountNaira, source: 'webhook' });
    res.status(200).json({ ok: true });
  } catch (e) {
    // Log-worthy, but still ack 200 — creditPurchase is idempotent, so a
    // transient failure here just means the client-side verify call (which
    // already ran, in most cases) is the source of truth for this payment.
    console.error('Paystack webhook credit error:', e);
    res.status(200).json({ ok: false, error: e.message });
  }
}
