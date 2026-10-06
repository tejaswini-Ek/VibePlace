import { Router, type IRouter } from "express";
import { GetRecommendationsQueryParams, GetRecommendationsResponse } from "@workspace/api-zod";
import { getWeather } from "../services/weather";
import { fetchPlaces } from "../services/openStreetMap";
import { categoriesForMood, resolveCenter } from "./places";

const router: IRouter = Router();

router.get("/recommendations", async (req, res): Promise<void> => {
  const parsed = GetRecommendationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported mood and provide a location." });
    return;
  }

  const input = parsed.data;
  const location = input.location?.trim() ?? "";
  if (!location && (input.latitude === undefined || input.longitude === undefined)) {
    res.status(400).json({ error: "Choose a location before asking for recommendations." });
    return;
  }

  try {
    const center = await resolveCenter(input.latitude, input.longitude, location);
    if (!center) {
      res.status(400).json({ error: "We could not find that location." });
      return;
    }

    let weatherHint: string | null = null;
    let categories = categoriesForMood(input.mood);
    const suppliedWeather = input.weather?.toLowerCase() ?? "";
    const rainyByQuery = ["rain", "raining", "indoor"].includes(suppliedWeather);
    if (rainyByQuery) {
      categories = ["restaurant", "cafe", "shopping", "hotel"];
      weatherHint = "Rain is expected, so these indoor places are prioritized.";
    } else if (input.weather) {
      weatherHint = "Outdoor options are included for the selected conditions.";
    } else {
      try {
        const report = await getWeather(center);
        weatherHint = report.recommendationHint;
        if (report.isRaining) categories = ["restaurant", "cafe", "shopping", "hotel"];
      } catch (err) {
        req.log.warn({ err }, "Weather unavailable; recommending by mood and location only");
      }
    }

    const places = await fetchPlaces(center, input.radiusKm, categories);
    res.json(
      GetRecommendationsResponse.parse({
        mood: input.mood,
        matchedCategory: categories.join(", "),
        weatherHint,
        places: places.slice(0, 12),
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Recommendation lookup failed");
    res.status(502).json({ error: "Recommendations are temporarily unavailable." });
  }
});

export default router;
