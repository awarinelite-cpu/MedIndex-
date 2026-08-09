// src/utils/paystack.js
// Lazy-loads Paystack's Inline JS (no need to touch index.html / add it to
// every page load) and wraps the popup in a promise-friendly call.
//
// Requires REACT_APP_PAYSTACK_PUBLIC_KEY set at build time (Vercel project
// settings + local .env). Paystack public keys are meant to be exposed
// client-side — the secret key never appears anywhere in this repo's
// client code, only in the server routes (api/paystack-verify.js,
// api/paystack-webhook.js) via PAYSTACK_SECRET_KEY.

let scriptPromise = null;

function loadPaystackScript() {
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Could not load the payment provider. Check your connection and try again.'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * @param {Object} params
 * @param {string} params.email       - the signed-in user's email
 * @param {string} params.uid         - the signed-in user's Firebase uid (embedded in metadata for server-side verification)
 * @param {number} params.amountNaira - whole naira amount (converted to kobo internally)
 * @returns {Promise<{ reference: string }>} resolves on successful charge; rejects if the popup is closed without paying
 */
export async function payWithPaystack({ email, uid, amountNaira }) {
  const publicKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('Payments are not configured yet — missing REACT_APP_PAYSTACK_PUBLIC_KEY.');
  }
  const PaystackPop = await loadPaystackScript();

  return new Promise((resolve, reject) => {
    const handler = PaystackPop.setup({
      key: publicKey,
      email,
      amount: Math.round(amountNaira * 100), // kobo
      currency: 'NGN',
      metadata: { uid },
      callback: (response) => resolve({ reference: response.reference }),
      onClose: () => reject(new Error('cancelled')),
    });
    handler.openIframe();
  });
}
