// Vercel Edge Function — looks for a REAL drug/packaging image from sources
// that are actually free to use, instead of guessing from an arbitrary web
// image search:
//
//   1. Wikimedia Commons  — almost everything there is CC-BY/CC-BY-SA or
//      public domain, and the API returns the exact license per image so we
//      can only accept results we can legally show.
//   2. openFDA (Structured Product Labeling)  — U.S. government drug label
//      data, public domain, sometimes includes packaging/label images.
//
// Neither source is scraped or hotlinked blindly: we only return an image
// together with its license + attribution, and the UI is expected to show
// both. If nothing turns up, the caller should fall back to the existing
// AI-illustration flow (generate-drug-image.js) rather than widen the search
// to unlicensed sources — see that file's header comment for why.

export const config = { runtime: 'edge', regions: ['iad1'] };

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const OPENFDA_API = 'https://api.fda.gov/drug/label.json';

// Licenses we're comfortable displaying automatically. Anything else
// (e.g. "non-free", unclear/no template) is skipped.
const ACCEPTABLE_LICENSE_RE = /(public domain|pd-|cc0|cc-by(-sa)?[- ]?[0-9]|cc-by(-sa)?$)/i;

async function searchCommons(genericName) {
  const searchUrl = `${COMMONS_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(
    `${genericName} drug tablet OR capsule OR ampoule OR vial OR packaging filetype:bitmap`
  )}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata|mime&format=json&origin=*`;

  const res = await fetch(searchUrl);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;
    const mime = info.mime || '';
    if (!mime.startsWith('image/')) continue;

    const meta = info.extmetadata || {};
    const licenseShort = meta.LicenseShortName?.value || '';
    const usageTerms = meta.UsageTerms?.value || '';
    const licenseText = `${licenseShort} ${usageTerms}`;
    if (!ACCEPTABLE_LICENSE_RE.test(licenseText)) continue;

    return {
      imageUrl: info.url,
      source: 'Wikimedia Commons',
      sourcePageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      license: licenseShort || 'See source page for license',
      attribution: meta.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons contributors',
    };
  }
  return null;
}

async function searchOpenFda(genericName) {
  const url = `${OPENFDA_API}?search=openfda.generic_name:"${encodeURIComponent(genericName)}"&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.results?.[0];
  // openFDA label records rarely embed a direct image URL — this mainly
  // confirms the record exists / gives us a source link to offer as a
  // fallback reference even when we can't pull a picture from it.
  if (!result) return null;
  const setId = result.set_id || result.id;
  if (!setId) return null;
  return {
    imageUrl: null,
    source: 'openFDA / DailyMed',
    sourcePageUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`,
    license: 'U.S. Government work (public domain)',
    attribution: 'U.S. National Library of Medicine — DailyMed',
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { genericName } = body || {};
  if (!genericName || typeof genericName !== 'string') {
    return new Response(JSON.stringify({ error: 'genericName is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const commonsResult = await searchCommons(genericName);
    if (commonsResult) {
      return new Response(JSON.stringify({ found: true, ...commonsResult }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Commons search failed:', err);
    // fall through to openFDA
  }

  try {
    const fdaResult = await searchOpenFda(genericName);
    if (fdaResult) {
      return new Response(JSON.stringify({ found: true, ...fdaResult }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('openFDA search failed:', err);
  }

  return new Response(JSON.stringify({ found: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
