import { OSM_CATEGORY_TAGS } from '../utils/placeData.js';

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const placeCache = new Map();

function readCache(key) {
  const entry = placeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    placeCache.delete(key);
    return null;
  }
  return entry.elements;
}

function writeCache(key, elements) {
  placeCache.set(key, { elements, expiresAt: Date.now() + CACHE_TTL_MS });
  if (placeCache.size > MAX_CACHE_ENTRIES) {
    placeCache.delete(placeCache.keys().next().value);
  }
}

export function buildOverpassQuery(latitude, longitude, radius, categories) {
  const selectors = categories.flatMap((category) => {
    const tags = OSM_CATEGORY_TAGS[category];
    return tags.map(([key, value]) =>
      `nwr(around:${radius},${latitude},${longitude})["${key}"="${value}"];`,
    );
  });

  return `[out:json][timeout:25];(${selectors.join('')});out center tags;`;
}

function dedupeElements(elements) {
  const seen = new Set();
  return elements.filter((element) => {
    const id = `${element?.type || 'node'}:${element?.id}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function fetchPlaces(query, { signal } = {}) {
  const cached = readCache(query);
  if (cached) return cached;

  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const provider = new URL(endpoint).hostname;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const requestSignal = signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'MoodBasedPlaceRecommender/1.0',
          },
          body: new URLSearchParams({ data: query }),
          signal: requestSignal,
        });

        if (!response.ok) {
          lastError = new Error(`Place search provider returned ${response.status}.`);
          lastError.statusCode = response.status;
          lastError.code = response.status === 429 ? 'OVERPASS_RATE_LIMITED' : 'OVERPASS_HTTP_ERROR';
          lastError.provider = provider;
          if (response.status < 500 && response.status !== 429) break;
        } else {
          let data;
          try {
            data = await response.json();
          } catch {
            lastError = new Error('Place search provider returned invalid JSON.');
            lastError.code = 'OVERPASS_INVALID_JSON';
            lastError.provider = provider;
            break;
          }
          if (!Array.isArray(data.elements)) {
            lastError = new Error('Place search provider returned an invalid response.');
            lastError.code = 'OVERPASS_INVALID_RESPONSE';
            lastError.provider = provider;
            break;
          }

          const elements = dedupeElements(data.elements);
          writeCache(query, elements);
          return elements;
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = Object.assign(new Error('Place search provider request failed.'), {
          code: error.name === 'TimeoutError' ? 'OVERPASS_TIMEOUT' : 'OVERPASS_NETWORK_ERROR',
          provider,
          cause: error,
        });
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  throw lastError || new Error('Place search providers are unavailable.');
}
