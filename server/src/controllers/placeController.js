import { categoriesForSearch, placeFromOverpass } from '../utils/placeData.js';
import { locationFields, prioritizeLocalities } from '../utils/geocoding.js';
import { searchGeocodingFeatures } from '../services/geocodingService.js';
import { buildOverpassQuery, fetchPlaces } from '../services/osmService.js';

function readCoordinate(value) {
  if (value === undefined || value === '') return undefined;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

async function geocodeLocation(query, signal) {
  const features = await searchGeocodingFeatures(query, { limit: 8, signal });
  const [result] = prioritizeLocalities(features, query);
  if (!result) return null;

  const [longitude, latitude] = result.geometry?.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const fields = locationFields(result.properties || {});
  return {
    latitude,
    longitude,
    address: {
      city: fields.city || undefined,
      state: fields.state || undefined,
      country: fields.country || undefined,
        countryCode: fields.countryCode || undefined,
    },
  };
}

export async function searchPlaces(req, res, next) {
  const location = String(req.query.location || '').trim();
  const mood = String(req.query.mood || 'relax').trim().toLowerCase();
  const category = String(req.query.category || 'all').trim().toLowerCase();
  const requestedRadius = Number(req.query.radius || 10);
  const radius = Number.isFinite(requestedRadius) ? Math.min(Math.max(requestedRadius, 1), 20) * 1000 : 5000;
  const placeId = String(req.query.placeId || '').trim();
  const requestedPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 30));
  let latitude = readCoordinate(req.query.latitude);
  let longitude = readCoordinate(req.query.longitude);

  if (location.length > 200) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Location must be 200 characters or fewer.' },
    });
  }
  if (!location && (latitude === undefined || longitude === undefined)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Choose a location or provide map coordinates to search.' },
    });
  }
  if (
    latitude !== undefined &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Latitude and longitude are outside their valid ranges.' },
    });
  }
  if (placeId && !/^(node|way|relation)-\d+$/.test(placeId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'A valid OpenStreetMap place ID is required.' },
    });
  }

  const categories = categoriesForSearch(mood, category);
  if (!categories.length) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'The selected place type is not supported.' },
    });
  }

  const controller = new AbortController();
  const abortRequest = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.once('close', abortRequest);

  let stage = 'resolving-location';
  try {
    let resolvedLocation = {
      latitude,
      longitude,
      address: {
        city: req.query.city ? String(req.query.city) : undefined,
        state: req.query.state ? String(req.query.state) : undefined,
        country: req.query.country ? String(req.query.country) : undefined,
        countryCode: req.query.countryCode ? String(req.query.countryCode) : undefined,
      },
    };

    if (latitude === undefined || longitude === undefined) {
      resolvedLocation = await geocodeLocation(location, controller.signal);
      if (!resolvedLocation) {
        return res.status(200).json({
          success: true,
          items: [],
          places: [],
          total: 0,
          page: 1,
          pageSize: 0,
          hasMore: false,
          centerLatitude: null,
          centerLongitude: null,
          message: 'We could not locate that area or city. Try choosing a location suggestion or include its city and country.',
        });
      }
      latitude = resolvedLocation.latitude;
      longitude = resolvedLocation.longitude;
    }

    stage = 'overpass';
    const query = buildOverpassQuery(latitude, longitude, radius, categories);
    const elements = await fetchPlaces(query, { signal: controller.signal });
    const center = { latitude, longitude };
    stage = 'transforming-place-results';
    const allItems = elements
      .map((element) => placeFromOverpass(element, center, resolvedLocation.address))
      .filter(Boolean)
      .sort((left, right) => left.distanceKm - right.distanceKm);

    const matchedPlace = placeId ? allItems.find((place) => place.id === placeId) : null;
    const items = placeId
      ? matchedPlace ? [matchedPlace] : []
      : allItems.slice((requestedPage - 1) * pageSize, requestedPage * pageSize);

    return res.status(200).json({
      success: true,
      items,
      total: placeId ? items.length : allItems.length,
      page: placeId ? 1 : requestedPage,
      pageSize: placeId ? items.length : pageSize,
      hasMore: !placeId && requestedPage * pageSize < allItems.length,
      centerLatitude: latitude,
      centerLongitude: longitude,
      message: items.length
        ? 'Showing the available places found in OpenStreetMap.'
        : placeId
          ? 'Place details are no longer available from OpenStreetMap.'
          : 'No places were found for this search.',
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    const serviceError = new Error('Place service is temporarily unavailable. Please try again.');
    serviceError.statusCode = 502;
    serviceError.stage = stage;
    serviceError.cause = error;
    return next(serviceError);
  } finally {
    res.off('close', abortRequest);
  }
}
