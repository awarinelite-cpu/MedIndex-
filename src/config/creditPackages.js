// src/config/creditPackages.js
// Display-only mirror of api/_lib/credits.js CREDIT_PACKAGES. Keep these
// two in sync — the server always re-derives the credit count from the
// amount actually paid, so this file only controls what the Buy Credits
// screen shows and offers; it can never be used to buy credits at a wrong
// rate even if it drifts out of sync.
export const CREDIT_PACKAGES = [
  { amountNaira: 500,  credits: 20,  label: 'Starter' },
  { amountNaira: 1000, credits: 45,  label: 'Popular', highlight: true },
  { amountNaira: 2500, credits: 120, label: 'Value' },
  { amountNaira: 5000, credits: 260, label: 'Bulk' },
];
