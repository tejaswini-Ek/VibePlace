const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const PHOTON_ENDPOINT = process.env.PHOTON_URL || 'https://photon.komoot.io/api/';
const featureCache = new Map();

function getCached(key) {
  const entry = featureCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    featureCache.delete(key);
    return null;
  }
  return entry.features;
}

function setCached(key, features) {
  featureCache.set(key, { features, expiresAt: Date.now() + CACHE_TTL_MS });
  if (featureCache.size > MAX_CACHE_ENTRIES) {
    featureCache.delete(featureCache.keys().next().value);
  }
}

export async function searchGeocodingFeatures(query, { limit = 8, signal } = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return [];

  const cacheKey = `${normalizedQuery.toLowerCase()}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL(PHOTON_ENDPOINT);
  url.search = new URLSearchParams({ limit: String(limit), q: normalizedQuery }).toString();
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
    : AbortSignal.timeout(12000);
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
    signal: requestSignal,
  });

  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status}).`);
  }

  const data = await response.json();
  if (!Array.isArray(data.features)) {
    throw new Error('Location lookup provider returned an invalid response.');
  }

  setCached(cacheKey, data.features);
  return data.features;
}
