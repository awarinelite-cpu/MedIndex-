// api/_lib/externalDrugSources.js
//
// Pulls grounding data from free, public, keyless drug reference APIs so
// the providers that have no native web search (Claude, OpenAI, DeepSeek,
// Kimi) can ground their answers in real external drug-bank data instead
// of training-data recall alone. Gemini already gets live grounding via
// its own Google Search tool (see api/drug-ai-details.js) — this module
// gives the other four providers a comparable, source-backed baseline.
//
// Sources used (both free, no API key required):
//   - openFDA drug label API : https://open.fda.gov/apis/drug/label/
//   - RxNorm (NIH/NLM)       : https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
//
// IMPORTANT: failures here must NEVER break the main AI call. Every
// function degrades to null/empty rather than throwing, and the whole
// lookup is time-boxed so a slow external API can't stall the response.

const FETCH_TIMEOUT_MS = 4000;

async function fetchJsonWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(str, max = 500) {
  if (!str) return '';
  const clean = String(str).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

async function fetchOpenFDA(genericName) {
  const byGeneric = encodeURIComponent(`openfda.generic_name:"${genericName}"`);
  let data = await fetchJsonWithTimeout(`https://api.fda.gov/drug/label.json?search=${byGeneric}&limit=1`);

  if (!data?.results?.length) {
    // Exact generic-name match missed — try the active-substance field instead.
    const bySubstance = encodeURIComponent(`openfda.substance_name:"${genericName}"`);
    data = await fetchJsonWithTimeout(`https://api.fda.gov/drug/label.json?search=${bySubstance}&limit=1`);
  }

  const r = data?.results?.[0];
  if (!r) return null;

  const fields = {
    'Indications & Usage': r.indications_and_usage?.[0],
    'Contraindications': r.contraindications?.[0],
    'Warnings': r.warnings?.[0] || r.warnings_and_cautions?.[0],
    'Dosage & Administration': r.dosage_and_administration?.[0],
    'Drug Interactions': r.drug_interactions?.[0],
    'Adverse Reactions': r.adverse_reactions?.[0],
    'Pregnancy': r.pregnancy?.[0],
  };
  const lines = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${truncate(v)}`);
  if (!lines.length) return null;

  return {
    brandName: r.openfda?.brand_name?.[0] || null,
    manufacturer: r.openfda?.manufacturer_name?.[0] || null,
    text: lines.join('\n'),
  };
}

async function fetchRxNorm(genericName) {
  const nameData = await fetchJsonWithTimeout(
    `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(genericName)}&search=2`
  );
  const rxcui = nameData?.idGroup?.rxnormId?.[0];
  if (!rxcui) return null;

  const brandsData = await fetchJsonWithTimeout(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN`
  );
  const brandNames = (brandsData?.relatedGroup?.conceptGroup || [])
    .flatMap((g) => g.conceptProperties || [])
    .map((p) => p.name)
    .filter(Boolean)
    .slice(0, 8);

  return { rxcui, brandNames };
}

/**
 * Fetches and combines openFDA + RxNorm data into one compact, labeled
 * text block ready to splice into an AI prompt as grounding context.
 * Always resolves — returns '' (never null/throws) when nothing was
 * found or both lookups failed, so callers can interpolate it safely.
 */
export async function fetchExternalDrugContext(genericName) {
  if (!genericName || typeof genericName !== 'string') return '';

  const [fda, rx] = await Promise.all([
    fetchOpenFDA(genericName).catch(() => null),
    fetchRxNorm(genericName).catch(() => null),
  ]);

  if (!fda && !rx) return '';

  const parts = [];
  if (fda) {
    const meta = [
      fda.brandName ? `brand: ${fda.brandName}` : null,
      fda.manufacturer ? `mfr: ${fda.manufacturer}` : null,
    ].filter(Boolean).join(', ');
    parts.push(`--- openFDA verified label data${meta ? ` (${meta})` : ''} ---\n${fda.text}`);
  }
  if (rx?.brandNames?.length) {
    parts.push(`--- RxNorm known brand names (RxCUI ${rx.rxcui}) ---\n${rx.brandNames.join(', ')}`);
  }
  if (!parts.length) return '';

  return parts.join('\n\n');
}
