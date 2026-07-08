// src/context/AiProviderContext.js
//
// Stores the user's chosen AI provider and exposes a helper that maps it
// to the correct /api endpoint. Persisted in localStorage so the choice
// survives page refreshes.

import React, { createContext, useContext, useState, useCallback } from 'react';

export const AI_PROVIDERS = [
  {
    id:       'gemini',
    label:    'Gemini',
    sublabel: 'Google',
    icon:     '✦',
    color:    '#4285F4',
    endpoint: '/api/drug-ai-details',
  },
  {
    id:       'claude',
    label:    'Claude',
    sublabel: 'Anthropic',
    icon:     '◆',
    color:    '#CC785C',
    endpoint: '/api/drug-ai-claude',
  },
  {
    id:       'openai',
    label:    'ChatGPT',
    sublabel: 'OpenAI',
    icon:     '⬡',
    color:    '#10A37F',
    endpoint: '/api/drug-ai-openai',
  },
  {
    id:       'deepseek',
    label:    'DeepSeek',
    sublabel: 'DeepSeek AI',
    icon:     '◉',
    color:    '#2563EB',
    endpoint: '/api/drug-ai-deepseek',
  },
  {
    id:       'kimi',
    label:    'Kimi',
    sublabel: 'Moonshot AI',
    icon:     '◈',
    color:    '#7C3AED',
    endpoint: '/api/drug-ai-kimi',
  },
];

const STORAGE_KEY = 'medindex_ai_provider';

const AiProviderContext = createContext(null);

export function AiProviderProvider({ children }) {
  const [providerId, setProviderId] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && AI_PROVIDERS.find(p => p.id === stored)) return stored;
    } catch {}
    return 'gemini';
  });

  const setProvider = useCallback((id) => {
    if (!AI_PROVIDERS.find(p => p.id === id)) return;
    setProviderId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const provider = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];

  return (
    <AiProviderContext.Provider value={{ provider, providerId, setProvider, providers: AI_PROVIDERS }}>
      {children}
    </AiProviderContext.Provider>
  );
}

export function useAiProvider() {
  const ctx = useContext(AiProviderContext);
  if (!ctx) throw new Error('useAiProvider must be used within AiProviderProvider');
  return ctx;
}
