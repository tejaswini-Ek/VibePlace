import { cacheGet, cacheSet } from "./cache";
import type { Coordinates } from "./geo";

export type WeatherReport = {
  temperatureC: number;
  condition: string;
  isRaining: boolean;
  recommendationHint: string;
};

type OpenMeteoResponse = {
  current?: { temperature_2m?: number; precipitation?: number; rain?: number; weather_code?: number };
};

const weatherDescriptions: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Severe thunderstorm",
};

export async function getWeather(center: Coordinates): Promise<WeatherReport> {
  const cacheKey = `weather:v1:${center.latitude.toFixed(2)}:${center.longitude.toFixed(2)}`;
  const cached = await cacheGet<WeatherReport>(cacheKey);
  if (cached) return cached;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(center.latitude));
  url.searchParams.set("longitude", String(center.longitude));
  url.searchParams.set("current", "temperature_2m,precipitation,rain,weather_code");
  url.searchParams.set("forecast_days", "1");
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}`);
  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;
  if (typeof current?.temperature_2m !== "number" || typeof current.weather_code !== "number") {
    throw new Error("Weather service returned an incomplete response.");
  }

  const isRaining =
    current.weather_code >= 51 ||
    current.weather_code === 45 ||
    current.weather_code === 48 ||
    (current.precipitation ?? 0) > 0;
  const report: WeatherReport = {
    temperatureC: current.temperature_2m,
    condition: weatherDescriptions[current.weather_code] ?? "Variable conditions",
    isRaining,
    recommendationHint: isRaining
      ? "Rain is expected; indoor places may be more comfortable."
      : "Conditions look suitable for outdoor places.",
  };
  await cacheSet(cacheKey, report, 15 * 60);
  return report;
}
