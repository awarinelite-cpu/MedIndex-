// api/_lib/credits.js
// Node.js-only (uses firebase-admin) — shared by /api/ai-credits,
// /api/paystack-verify, and /api/paystack-webhook. Never import this from
// an Edge runtime file.
//
// Wallet lives at users/{uid}/wallet/credits and is never writable by the
// client SDK (see firestore.rules) — only these server routes, running
// under the Admin SDK, can change a balance. That's the whole point: a
// user editing Firestore from devtools cannot give themselves free credits.

import { adminDb } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const STARTER_CREDITS = 3;         // free credits a brand-new account starts with
export const CLINICAL_PLAN_COST = 1;      // credits charged per AI Clinical Consult / AI Drug Insight generation

// Naira → credits bundles offered on the Buy Credits screen. Keep this in
// sync with src/config/creditPackages.js on the client (client copy is
// display-only; the server is always the source of truth for what a given
// amountNaira actually buys).
export const CREDIT_PACKAGES = {
  500:  20,
  1000: 45,
  2500: 120,
  5000: 260,
};

function walletRef(uid) {
  return adminDb().collection('users').doc(uid).collection('wallet').doc('credits');
}

// Reads the wallet, creating it with the starter balance on first touch.
// Safe to call repeatedly (e.g. once per app load) — a no-op after the
// first time.
export async function ensureWallet(uid) {
  const ref = walletRef(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();

  const initial = { balance: STARTER_CREDITS, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await ref.set(initial, { merge: true });
  return { balance: STARTER_CREDITS };
}

// Atomically deducts `amount` credits if (and only if) the balance covers
// it. Throws a 402-flagged error otherwise — callers should surface that
// as "buy more credits" rather than a generic failure.
export async function consumeCredits(uid, amount = CLINICAL_PLAN_COST) {
  const ref = walletRef(uid);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const balance = snap.exists ? (snap.data().balance || 0) : STARTER_CREDITS;
    if (balance < amount) {
      const err = new Error('Not enough AI credits. Buy more to continue.');
      err.status = 402;
      err.balance = balance;
      throw err;
    }
    const next = balance - amount;
    tx.set(ref, { balance: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
}

// Credits a successful Paystack payment. Idempotent: guarded by a ledger
// doc keyed on the Paystack reference, so a webhook firing after (or
// racing with) the client-side verify call can never double-credit the
// same payment.
export async function creditPurchase({ uid, reference, amountNaira, source }) {
  const credits = CREDIT_PACKAGES[amountNaira];
  if (!credits) {
    const err = new Error(`No credit package configured for ₦${amountNaira}.`);
    err.status = 400;
    throw err;
  }

  const purchaseRef = adminDb().collection('credit_purchases').doc(reference);
  const wRef = walletRef(uid);

  return adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(purchaseRef);
    if (existing.exists) {
      // Already processed by an earlier verify/webhook call — return the
      // current balance without crediting again.
      const wSnap = await tx.get(wRef);
      return { balance: wSnap.exists ? wSnap.data().balance : 0, alreadyProcessed: true };
    }

    const wSnap = await tx.get(wRef);
    const currentBalance = wSnap.exists ? (wSnap.data().balance || 0) : 0;
    const nextBalance = currentBalance + credits;

    tx.set(wRef, { balance: nextBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(purchaseRef, {
      uid, reference, amountNaira, credits, source: source || 'unknown',
      processedAt: FieldValue.serverTimestamp(),
    });

    return { balance: nextBalance, alreadyProcessed: false, creditsAdded: credits };
  });
}
