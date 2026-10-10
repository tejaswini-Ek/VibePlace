const WEATHER_CODES = new Map([
  [0, 'Clear sky'],
  [1, 'Mainly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Depositing rime fog'],
  [51, 'Light drizzle'],
  [53, 'Drizzle'],
  [55, 'Heavy drizzle'],
  [61, 'Light rain'],
  [63, 'Rain'],
  [65, 'Heavy rain'],
  [71, 'Light snow'],
  [73, 'Snow'],
  [75, 'Heavy snow'],
  [80, 'Rain showers'],
  [81, 'Rain showers'],
  [82, 'Heavy rain showers'],
  [95, 'Thunderstorm'],
  [96, 'Thunderstorm with hail'],
  [99, 'Thunderstorm with hail'],
]);

export async function getWeather(req, res, next) {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required for weather.' });
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: '2',
      timezone: 'auto',
    }).toString();

    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      return res.status(502).json({ error: 'Weather information is temporarily unavailable.' });
    }

    const data = await response.json();
    const current = data.current;
    if (!current || !Number.isFinite(Number(current.temperature_2m))) {
      return res.status(502).json({ error: 'Weather provider returned incomplete data.' });
    }

    const currentHour = data.hourly?.time?.indexOf(current.time) ?? -1;
    const hourly = (data.hourly?.time || [])
      .slice(Math.max(currentHour, 0), Math.max(currentHour, 0) + 6)
      .map((time, index) => {
        const sourceIndex = Math.max(currentHour, 0) + index;
        return {
          time,
          temperatureC: data.hourly.temperature_2m?.[sourceIndex] ?? null,
          precipitationProbability: data.hourly.precipitation_probability?.[sourceIndex] ?? null,
          condition: WEATHER_CODES.get(data.hourly.weather_code?.[sourceIndex]) || 'Unknown',
        };
      });

    const daily = (data.daily?.time || []).map((date, index) => ({
      date,
      highC: data.daily.temperature_2m_max?.[index] ?? null,
      lowC: data.daily.temperature_2m_min?.[index] ?? null,
      precipitationProbability: data.daily.precipitation_probability_max?.[index] ?? null,
      condition: WEATHER_CODES.get(data.daily.weather_code?.[index]) || 'Unknown',
    }));

    return res.json({
      available: true,
      latitude,
      longitude,
      timezone: data.timezone || null,
      temperatureC: current.temperature_2m,
      humidityPercent: current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      condition: WEATHER_CODES.get(current.weather_code) || 'Unknown',
      hourly,
      daily,
    });
  } catch (error) {
    return next(Object.assign(new Error('Weather information is temporarily unavailable.'), { statusCode: 502 }));
  }
}
