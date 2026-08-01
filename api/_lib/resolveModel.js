// api/_lib/resolveModel.js
//
// Shared model resolver for every AI provider endpoint (Gemini, Claude,
// OpenAI, DeepSeek, Kimi). Lets the admin Settings tab change which model
// each provider uses at runtime — no redeploy, no env var edits — by
// storing the choice in Firestore at app_config/ai_settings.
//
// Reads via the plain Firestore REST API (not the SDK), so this works
// identically in both Edge runtime (Gemini/OpenAI/DeepSeek/Kimi) and the
// Node.js runtime (Claude) without needing firebase-admin. app_config is
// "public read, signed-in write" in firestore.rules, so no auth token is
// needed here — only the admin panel's write is gated behind sign-in.
//
// Each provider's resolved model is cached in memory per field for
// CACHE_TTL_MS, scoped per warm serverless instance (each provider is a
// separate function/file, so there's no cross-provider cache bleed).
// Falls back to the env var, then the hardcoded default, if the Firestore
// doc doesn't have that field yet, or the fetch fails for any reason.

const FIREBASE_PROJECT_ID = 'nacon-post-utme-past-question';
const FIREBASE_API_KEY = 'AIzaSyAB8yCfmdvOTWRpj50Hhc7AWuabWLDvy6k';
const CACHE_TTL_MS = 60_000;

const cache = {}; // { [field]: { value, fetchedAt } }

/**
 * @param {object} opts
 * @param {string} opts.field    Firestore field name on app_config/ai_settings, e.g. "geminiModel"
 * @param {Set<string>} opts.allowed  Set of model ids the admin panel is allowed to select
 * @param {string} [opts.envVar] Name of the env var fallback, e.g. "GEMINI_MODEL"
 * @param {string} opts.fallback Hardcoded default if nothing else resolves
 * @returns {Promise<string>} the model id to use
 */
export async function resolveModel({ field, allowed, envVar, fallback }) {
  const now = Date.now();
  const cached = cache[field];
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/app_config/ai_settings?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const chosen = json?.fields?.[field]?.stringValue;
      if (chosen && allowed.has(chosen)) {
        cache[field] = { value: chosen, fetchedAt: now };
        return chosen;
      }
    }
  } catch {
    // Network hiccup or doc doesn't exist yet — fall through to env/default.
  }

  const value = (envVar && process.env[envVar]) || fallback;
  cache[field] = { value, fetchedAt: now };
  return value;
}
