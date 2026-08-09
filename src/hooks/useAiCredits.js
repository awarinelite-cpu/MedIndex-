// src/hooks/useAiCredits.js
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/apiBase';
import { auth } from '../firebase';

// balance: number | null (null while loading or for an admin/unlimited account)
// unlimited: true for admins — they're exempt from AI credit charges
export function useAiCredits() {
  const { user } = useAuth();
  const [balance, setBalance]     = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/api/ai-credits'), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load AI credit balance.');
      setBalance(data.balance);
      setUnlimited(Boolean(data.unlimited));
    } catch (e) {
      setError(e.message || 'Failed to load AI credit balance.');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { balance, unlimited, loading, error, refresh };
}
