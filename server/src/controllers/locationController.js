import { locationFields, prioritizeLocalities } from '../utils/geocoding.js';
import { searchGeocodingFeatures } from '../services/geocodingService.js';

export async function searchLocations(req, res, next) {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }
  if (query.length > 200) {
    return res.status(400).json({ error: 'Search query must be 200 characters or fewer.' });
  }

  const controller = new AbortController();
  const abortRequest = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.once('close', abortRequest);

  try {
    const features = await searchGeocodingFeatures(query, { limit: 8, signal: controller.signal });
    const items = prioritizeLocalities(features, query).map((feature) => {
      const item = feature.properties || {};
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      const { city, locality, state, country, countryCode } = locationFields(item);
      const name = item.name || locality || city || query;
      const displayName = [name, city, state, country]
        .filter(Boolean)
        .filter((part, index, parts) => parts.indexOf(part) === index)
        .join(', ');
      return {
        id: `${item.osm_type || 'place'}-${item.osm_id || feature.id || `${latitude}-${longitude}`}`,
        name,
        displayName: displayName || query,
        city,
        locality,
        state,
        country,
        countryCode,
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    }).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    return res.json(items);
  } catch (error) {
    if (controller.signal.aborted) return;
    const serviceError = new Error('Unable to search locations right now.');
    serviceError.statusCode = 502;
    serviceError.cause = error;
    return next(serviceError);
  } finally {
    res.off('close', abortRequest);
  }
}
