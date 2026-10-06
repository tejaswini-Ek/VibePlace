import { Router, type IRouter } from "express";
import { SearchPlacesQueryParams, SearchPlacesResponse } from "@workspace/api-zod";
import { rateLimit } from "express-rate-limit";
import { distanceKm } from "../services/geo";
import { categoryRules, fetchPlaces, geocodeLocation, type Place } from "../services/openStreetMap";

const router: IRouter = Router();
const placesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many place searches. Please wait a few minutes and try again." },
});

const moodCategories: Record<string, string[]> = {
  relax: ["park", "cafe"],
  date: ["restaurant", "cafe", "tourist-place"],
  party: ["bar", "restaurant"],
  work: ["cafe", "library"],
  outdoor: ["park", "tourist-place"],
  "quick-bite": ["restaurant", "cafe"],
};

export function normalizeCategory(input: string | undefined): string {
  const normalized = (input ?? "all")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  const aliases: Record<string, string> = {
    "tourist-place": "tourist-place",
    tourism: "tourist-place",
    "quick-bite": "restaurant",
    "quick-bites": "restaurant",
    "shopping-center": "shopping",
  };
  return aliases[normalized] ?? normalized;
}

export async function resolveCenter(
  latitude: number | undefined,
  longitude: number | undefined,
  locationText: string,
): Promise<{ latitude: number; longitude: number; city: string | null; state: string | null; country: string | null } | null> {
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error("Provide both latitude and longitude, or search by location name.");
  }
  if (latitude !== undefined && longitude !== undefined) {
    return { latitude, longitude, city: null, state: null, country: null };
  }
  const query = locationText.trim();
  if (!query) return null;
  const match = await geocodeLocation(query);
  return match
    ? {
        latitude: match.latitude,
        longitude: match.longitude,
        city: match.city,
        state: match.state,
        country: match.country,
      }
    : null;
}

export function categoriesForMood(mood: string | undefined): string[] {
  return (mood && moodCategories[mood]) || moodCategories.relax;
}

export function orderPlaces(places: Place[], sort: "distance" | "name"): Place[] {
  return [...places].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : (a.distanceKm ?? Number.POSITIVE_INFINITY) -
        (b.distanceKm ?? Number.POSITIVE_INFINITY),
  );
}

router.get("/places", placesLimiter, async (req, res): Promise<void> => {
  const parsed = SearchPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid place search parameters");
    res.status(400).json({ error: "Check the location, radius, and pagination values." });
    return;
  }

  const input = parsed.data;
  const locationText =
    input.location?.trim() ||
    [input.city, input.state, input.country].filter(Boolean).join(", ");
  if (!locationText && (input.latitude === undefined || input.longitude === undefined)) {
    res.status(400).json({ error: "Choose a location or allow access to your current location." });
    return;
  }

  try {
    const center = await resolveCenter(input.latitude, input.longitude, locationText);
    if (!center) {
      res.status(400).json({ error: "We could not find that location. Try adding a city and country." });
      return;
    }

    const category = normalizeCategory(input.category);
    const categories =
      input.category && category !== "all"
        ? [category]
        : categoriesForMood(input.mood);
    if (categories.some((item) => !categoryRules[item])) {
      res.status(400).json({ error: "Choose one of the supported place categories." });
      return;
    }

    let places = await fetchPlaces(center, input.radiusKm, categories);
    places = places.filter(
      (place) =>
        place.distanceKm == null ||
        place.distanceKm <= input.radiusKm + 0.05,
    );
    if (input.category && category !== "all") {
      places = places.filter((place) => place.category === category);
    }
    places = orderPlaces(places, input.sort);

    const total = places.length;
    const start = (input.page - 1) * input.pageSize;
    const items = places.slice(start, start + input.pageSize).map((place) => ({
      ...place,
      city: place.city ?? center.city,
      state: place.state ?? center.state,
      country: place.country ?? center.country,
    }));
    res.json(
      SearchPlacesResponse.parse({
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        centerLatitude: center.latitude,
        centerLongitude: center.longitude,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Place search failed");
    if (err instanceof Error && err.message.startsWith("Provide both")) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(502).json({ error: "Place data is temporarily unavailable. Please try again." });
  }
});

export default router;
