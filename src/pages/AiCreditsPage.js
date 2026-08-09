// src/pages/AiCreditsPage.js
// Route: /ai-credits
// Lets a signed-in user see their AI credit balance and top up via
// Paystack. Credits are spent by AI Clinical Consult / AI Drug Insight
// (mode: 'clinical_plan' on /api/drug-ai-details) — every other AI feature
// in the app stays free.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Zap, Check, AlertTriangle, RefreshCw, Infinity as InfinityIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiCredits } from '../hooks/useAiCredits';
import { apiUrl } from '../config/apiBase';
import { payWithPaystack } from '../utils/paystack';
import { auth } from '../firebase';
import { CREDIT_PACKAGES } from '../config/creditPackages';

export default function AiCreditsPage() {
  const { user } = useAuth();
  const { balance, unlimited, loading, error, refresh } = useAiCredits();
  const [buyingAmount, setBuyingAmount] = useState(null); // amountNaira currently in flight
  const [buyError, setBuyError]         = useState('');
  const [justBought, setJustBought]     = useState(null); // credits added, for a brief confirmation

  const handleBuy = async (pkg) => {
    if (!user) return;
    setBuyError('');
    setJustBought(null);
    setBuyingAmount(pkg.amountNaira);
    try {
      const { reference } = await payWithPaystack({
        email: user.email,
        uid: user.uid,
        amountNaira: pkg.amountNaira,
      });

      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/api/paystack-verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment succeeded but crediting your account failed — contact support with your reference: ' + reference);

      setJustBought(data.creditsAdded || pkg.credits);
      await refresh();
    } catch (e) {
      if (e.message !== 'cancelled') setBuyError(e.message || 'Something went wrong. Try again.');
    }
    setBuyingAmount(null);
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-drug-muted">Sign in to view and buy AI credits.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-drug-muted hover:text-drug-text mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-primary-50 rounded-lg">
          <Sparkles className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-drug-text">AI Credits</h1>
          <p className="text-drug-muted text-sm mt-0.5">Used by AI Clinical Consult and AI Drug Insight.</p>
        </div>
      </div>

      {/* Balance */}
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Current balance</div>
          {loading ? (
            <div className="text-2xl font-bold text-drug-text">…</div>
          ) : unlimited ? (
            <div className="flex items-center gap-1.5 text-2xl font-bold text-primary-700">
              <InfinityIcon className="w-6 h-6" /> Unlimited
            </div>
          ) : (
            <div className="text-2xl font-bold text-drug-text">{balance ?? 0} credit{balance === 1 ? '' : 's'}</div>
          )}
        </div>
        <button onClick={refresh} title="Refresh balance" className="p-2 rounded-lg hover:bg-gray-100 text-drug-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {unlimited && (
        <div className="mt-3 text-xs text-drug-muted bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
          Your account is exempt from AI credit charges (admin).
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
      )}

      {justBought && (
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <Check className="w-4 h-4 flex-shrink-0" /> {justBought} credits added to your account.
        </div>
      )}

      {buyError && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {buyError}
        </div>
      )}

      {/* Packages */}
      {!unlimited && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-drug-text mb-3">Buy more credits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CREDIT_PACKAGES.map((pkg) => {
              const isBuying = buyingAmount === pkg.amountNaira;
              return (
                <button
                  key={pkg.amountNaira}
                  onClick={() => handleBuy(pkg)}
                  disabled={buyingAmount !== null}
                  className={`text-left p-4 rounded-xl border transition-colors disabled:opacity-50 ${
                    pkg.highlight
                      ? 'border-primary-300 bg-primary-50 hover:bg-primary-100'
                      : 'border-drug-border bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary-600">{pkg.label}</span>
                    {pkg.highlight && <Zap className="w-4 h-4 text-primary-500" />}
                  </div>
                  <div className="text-xl font-bold text-drug-text">₦{pkg.amountNaira.toLocaleString()}</div>
                  <div className="text-sm text-drug-muted mt-0.5">{pkg.credits} credits</div>
                  <div className="mt-3 text-xs font-semibold text-primary-600">
                    {isBuying ? 'Opening checkout…' : 'Buy now →'}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-drug-muted leading-relaxed">
            Payments are processed securely by Paystack. 1 credit is used per AI Clinical Consult / AI Drug
            Insight generation. Every other AI feature in the app is free.
          </p>
        </div>
      )}
    </div>
  );
}
