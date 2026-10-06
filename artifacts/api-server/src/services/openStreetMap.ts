import { cacheGet, cacheSet } from "./cache";
import { distanceKm, type Coordinates } from "./geo";

type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OSMElement[] };

export type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  externalId: string;
  distanceKm: number | null;
};

export type Location = Coordinates & {
  id: string;
  name: string;
  displayName: string;
  city: string | null;
  state: string | null;
  country: string | null;
};

type CategoryRule = { category: string; key: string; value?: string };

export const categoryRules: Record<string, CategoryRule[]> = {
  restaurant: [
    { category: "restaurant", key: "amenity", value: "restaurant" },
    { category: "restaurant", key: "amenity", value: "fast_food" },
  ],
  cafe: [{ category: "cafe", key: "amenity", value: "cafe" }],
  park: [{ category: "park", key: "leisure", value: "park" }],
  hospital: [{ category: "hospital", key: "amenity", value: "hospital" }],
  shopping: [{ category: "shopping", key: "shop" }],
  "tourist-place": [
    { category: "tourist-place", key: "tourism" },
    { category: "tourist-place", key: "historic" },
  ],
  hotel: [
    { category: "hotel", key: "tourism", value: "hotel" },
    { category: "hotel", key: "tourism", value: "hostel" },
  ],
  gym: [{ category: "gym", key: "leisure", value: "fitness_centre" }],
  bar: [
    { category: "bar", key: "amenity", value: "bar" },
    { category: "bar", key: "amenity", value: "pub" },
  ],
  library: [{ category: "library", key: "amenity", value: "library" }],
  all: [
    { category: "restaurant", key: "amenity", value: "restaurant" },
    { category: "cafe", key: "amenity", value: "cafe" },
    { category: "park", key: "leisure", value: "park" },
    { category: "hospital", key: "amenity", value: "hospital" },
    { category: "shopping", key: "shop" },
    { category: "tourist-place", key: "tourism" },
    { category: "hotel", key: "tourism", value: "hotel" },
    { category: "gym", key: "leisure", value: "fitness_centre" },
    { category: "bar", key: "amenity", value: "bar" },
    { category: "library", key: "amenity", value: "library" },
  ],
};

const OVERPASS_URLS = Array.from(
  new Set(
    [
      process.env.OVERPASS_URL,
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter((url): url is string => Boolean(url)),
  ),
);
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_RESULT_LIMIT = 20;
const inFlightPlaceSearches = new Map<string, Promise<Place[]>>();

function userAgent(): string {
  return process.env.OSM_USER_AGENT || "MoodPlaceFinder/1.0 (OpenStreetMap place search)";
}

function normalizeLocation(raw: Record<string, unknown>): Location | null {
  const latitude = Number(raw.lat);
  const longitude = Number(raw.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = (raw.address ?? {}) as Record<string, string | undefined>;
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    null;
  return {
    id: `${String(raw.osm_type ?? "place")}/${String(raw.osm_id ?? raw.place_id ?? "")}`,
    name: String(raw.name ?? city ?? address.state ?? address.country ?? raw.display_name ?? "Location"),
    displayName: String(raw.display_name ?? "Location"),
    city,
    state: address.state ?? address.region ?? null,
    country: address.country ?? null,
    latitude,
    longitude,
  };
}

export async function searchLocations(query: string): Promise<Location[]> {
  const normalized = query.trim();
  const cacheKey = `nominatim:v1:${normalized.toLowerCase()}`;
  const cached = await cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("q", normalized);

  const response = await fetch(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);

  const body = (await response.json()) as Record<string, unknown>[];
  const locations = body
    .map(normalizeLocation)
    .filter((entry): entry is Location => entry !== null);
  await cacheSet(cacheKey, locations, 60 * 60);
  return locations;
}

export async function geocodeLocation(query: string): Promise<Location | null> {
  const [first] = await searchLocations(query);
  return first ?? null;
}

function buildOverpassQuery(center: Coordinates, radiusKm: number, categories: string[]): string {
  const rules = categories.flatMap((category) => categoryRules[category] ?? []);
  if (rules.length === 0) throw new Error("Choose a supported place category.");
  const radiusMeters = Math.round(radiusKm * 1000);
  const parkSearch = categories.length === 1 && categories[0] === "park";
  const filters = rules
    .map((rule) => {
      const valueFilter = rule.value
        ? `["${rule.key}"="${rule.value}"]`
        : `["${rule.key}"]`;
      const nameFilter = parkSearch ? '["name"]' : "";
      const objectTypes = parkSearch ? ["way"] : ["node", "way"];
      return objectTypes
        .map(
          (type) =>
            `${type}${valueFilter}${nameFilter}(around:${radiusMeters},${center.latitude},${center.longitude});`,
        )
        .join("");
    })
    .join("");
  const resultLimit = parkSearch ? 10 : OVERPASS_RESULT_LIMIT;
  return `[out:json][timeout:12];(${filters});out center tags ${resultLimit};`;
}

function categoryFromTags(tags: Record<string, string>, categories: string[]): string {
  for (const category of categories) {
    const rules = categoryRules[category] ?? [];
    const match = rules.find(
      (rule) => tags[rule.key] !== undefined && (!rule.value || tags[rule.key] === rule.value),
    );
    if (match) return match.category;
  }
  for (const rule of categoryRules.all) {
    if (tags[rule.key] !== undefined && (!rule.value || tags[rule.key] === rule.value)) {
      return rule.category;
    }
  }
  return "place";
}

function elementToPlace(element: OSMElement, center: Coordinates, categories: string[]): Place | null {
  const tags = element.tags ?? {};
  const coordinates = element.center ?? {
    lat: element.lat,
    lon: element.lon,
  };
  if (coordinates.lat == null || coordinates.lon == null) return null;
  const latitude = Number(coordinates.lat);
  const longitude = Number(coordinates.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const city =
    tags["addr:city"] ??
    tags["addr:town"] ??
    tags["addr:village"] ??
    tags["addr:municipality"] ??
    null;
  const address =
    tags["addr:full"] ??
    [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:suburb"],
      city,
      tags["addr:state"],
      tags["addr:postcode"],
    ]
      .filter(Boolean)
      .join(", ") ??
    "";
  const name = tags.name ?? tags["name:en"] ?? tags.operator ?? tags.brand;
  if (!name) return null;
  const externalId = `${element.type}/${element.id}`;

  return {
    id: externalId,
    externalId,
    name,
    category: categoryFromTags(tags, categories),
    address: address || [city, tags["addr:state"], tags["addr:country"]].filter(Boolean).join(", "),
    city,
    state: tags["addr:state"] ?? null,
    country: tags["addr:country"] ?? null,
    latitude,
    longitude,
    distanceKm: distanceKm(center, { latitude, longitude }),
  };
}

export async function fetchPlaces(
  center: Coordinates,
  radiusKm: number,
  categories: string[],
): Promise<Place[]> {
  const normalizedCategories = [...new Set(categories)].sort();
  const cacheKey = `overpass:aggregate:v4:${center.latitude.toFixed(4)}:${center.longitude.toFixed(4)}:${radiusKm}:${normalizedCategories.join(",")}`;
  const cached = await cacheGet<Place[]>(cacheKey);
  if (cached) return cached;

  const inFlight = inFlightPlaceSearches.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const collected: Place[] = [];
    for (const category of normalizedCategories) {
      collected.push(...(await fetchPlacesForCategory(center, radiusKm, category)));
    }
    const places = collected
      .filter(
        (place, index, all) =>
          all.findIndex((candidate) => candidate.externalId === place.externalId) === index,
      )
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, OVERPASS_RESULT_LIMIT);
    await cacheSet(cacheKey, places, 10 * 60);
    return places;
  })();

  inFlightPlaceSearches.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inFlightPlaceSearches.delete(cacheKey);
  }
}

async function fetchPlacesForCategory(
  center: Coordinates,
  radiusKm: number,
  category: string,
): Promise<Place[]> {
  const cacheKey = `overpass:category:v4:${center.latitude.toFixed(4)}:${center.longitude.toFixed(4)}:${radiusKm}:${category}`;
  const cached = await cacheGet<Place[]>(cacheKey);
  if (cached) return cached;

  const inFlight = inFlightPlaceSearches.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const query = buildOverpassQuery(center, radiusKm, [category]);
    let lastError: unknown;
    for (const endpoint of OVERPASS_URLS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": userAgent(),
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          lastError = new Error(`Overpass returned HTTP ${response.status}`);
          continue;
        }
        const result = (await response.json()) as OverpassResponse;
        const places = (result.elements ?? [])
          .map((element) => elementToPlace(element, center, [category]))
          .filter((place): place is Place => place !== null)
          .filter(
            (place, index, all) =>
              all.findIndex((candidate) => candidate.externalId === place.externalId) === index,
          )
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
          .slice(0, OVERPASS_RESULT_LIMIT);
        await cacheSet(cacheKey, places, 10 * 60);
        return places;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("OpenStreetMap is temporarily unavailable.");
  })();

  inFlightPlaceSearches.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inFlightPlaceSearches.delete(cacheKey);
  }
}
