function extractJsonObject(content) {
  const candidates = [content.trim(), content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      continue;
    }
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(content.slice(start, index + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {
          start = -1;
        }
      }
    }
  }

  throw new Error('The recommendation provider returned invalid JSON.');
}

function stringField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function getRecommendations(req, res, next) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return res.json({
      available: false,
      recommendation: null,
      reason: 'AI recommendations are not configured. Add GROQ_API_KEY to server/.env to enable them.',
    });
  }

  const { mood, location, places, weather } = req.body || {};
  if (!mood || !location || !Array.isArray(places) || places.length === 0) {
    return res.status(400).json({ error: 'Mood, location, and place data are required for a recommendation.' });
  }

  const context = {
    mood: String(mood).slice(0, 80),
    location: String(location).slice(0, 200),
    weather: weather && typeof weather === 'object' ? {
      temperatureC: weather.temperatureC ?? 'Not available',
      condition: weather.condition || 'Not available',
      humidityPercent: weather.humidityPercent ?? 'Not available',
      windSpeedKmh: weather.windSpeedKmh ?? 'Not available',
    } : null,
    places: places.slice(0, 3).map((place) => ({
      name: String(place.name || 'Unnamed place').slice(0, 120),
      type: String(place.category || 'Not available').slice(0, 80),
      rating: place.rating ?? 'Not available',
      price: place.priceRange ?? 'Not available',
      distanceKm: place.distanceKm ?? 'Not available',
      openStatus: place.openStatus || 'Unknown',
      openingHours: place.openingHours || 'Not available',
      address: place.address || 'Not available',
    })),
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You recommend places using only supplied data. Do not invent ratings, prices, opening hours, addresses, distances, or weather information. If data is unavailable, say so. Return ONLY valid JSON with string fields recommendation, reason, moodMatch, and weatherSuitability. Do not include markdown or text outside the JSON.',
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return next(Object.assign(new Error(`AI recommendation service returned ${response.status}.`), { statusCode: 502 }));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return next(Object.assign(new Error('AI recommendation service returned an empty response.'), { statusCode: 502 }));
    }

    const result = extractJsonObject(content);
    const recommendation = stringField(result.recommendation);
    if (!recommendation) {
      return next(Object.assign(new Error('AI recommendation service returned no recommendation.'), { statusCode: 502 }));
    }
    return res.json({
      available: true,
      recommendation,
      reason: stringField(result.reason),
      moodMatch: stringField(result.moodMatch),
      weatherSuitability: stringField(result.weatherSuitability),
    });
  } catch (error) {
    return next(Object.assign(new Error('AI recommendations are temporarily unavailable.'), { statusCode: 502, cause: error }));
  }
}
