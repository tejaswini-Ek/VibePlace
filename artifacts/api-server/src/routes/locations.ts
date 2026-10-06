import { Router, type IRouter } from "express";
import { SearchLocationsQueryParams, SearchLocationsResponse } from "@workspace/api-zod";
import { searchLocations } from "../services/openStreetMap";

const router: IRouter = Router();

router.get("/locations/search", async (req, res): Promise<void> => {
  const parsed = SearchLocationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter at least two letters to search for a location." });
    return;
  }

  try {
    const results = await searchLocations(parsed.data.query);
    res.json(SearchLocationsResponse.parse(results));
  } catch (err) {
    req.log.error({ err }, "Location search failed");
    res.status(502).json({ error: "Location suggestions are temporarily unavailable." });
  }
});

export default router;
