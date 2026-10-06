import { Router, type IRouter } from "express";
import { GetWeatherQueryParams, GetWeatherResponse } from "@workspace/api-zod";
import { getWeather } from "../services/weather";

const router: IRouter = Router();

router.get("/weather", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide valid latitude and longitude values." });
    return;
  }

  try {
    const report = await getWeather(parsed.data);
    res.json(GetWeatherResponse.parse(report));
  } catch (err) {
    req.log.error({ err }, "Weather lookup failed");
    res.status(502).json({ error: "Current weather is temporarily unavailable." });
  }
});

export default router;
