import mongoose from 'mongoose';
import { SearchHistory } from '../models/SearchHistory.js';
import { MOOD_CATEGORIES, OSM_CATEGORY_TAGS } from '../utils/placeData.js';

function readFiniteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

export async function listHistory(req, res, next) {
  try {
    const history = await SearchHistory.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json(history);
  } catch (error) {
    return next(error);
  }
}

export async function addHistory(req, res, next) {
  const locationValue = req.body?.location;
  if (typeof locationValue !== 'string') return res.status(400).json({ error: 'Location is required.' });
  const location = locationValue.trim();
  if (!location) return res.status(400).json({ error: 'Location is required.' });
  if (location.length > 200) return res.status(400).json({ error: 'Location must be 200 characters or fewer.' });

  if (
    ['city', 'state', 'country'].some((field) =>
      req.body?.[field] != null &&
      (typeof req.body[field] !== 'string' || req.body[field].length > 100),
    )
  ) {
    return res.status(400).json({ error: 'City, state, and country must be 100 characters or fewer.' });
  }
  if (
    (req.body?.category != null && typeof req.body.category !== 'string') ||
    (req.body?.mood != null && typeof req.body.mood !== 'string')
  ) {
    return res.status(400).json({ error: 'Mood and category must be valid text values.' });
  }
  const category = (req.body?.category || 'all').trim().toLowerCase();
  const mood = (req.body?.mood || 'relax').trim().toLowerCase();
  const radius = readFiniteNumber(req.body?.radius ?? 10);
  const resultsCount = req.body?.resultsCount;
  const latitude = req.body?.latitude;
  const longitude = req.body?.longitude;
  if (category !== 'all' && !Object.hasOwn(OSM_CATEGORY_TAGS, category)) {
    return res.status(400).json({ error: 'The selected place type is not supported.' });
  }
  if (!Object.hasOwn(MOOD_CATEGORIES, mood)) {
    return res.status(400).json({ error: 'The selected mood is not supported.' });
  }
  if (radius === null || radius < 1 || radius > 20) {
    return res.status(400).json({ error: 'Search radius must be between 1 and 20 kilometers.' });
  }

  let normalizedLatitude;
  let normalizedLongitude;
  if (
    (latitude == null) !== (longitude == null) ||
    (latitude === '' && longitude !== '') ||
    (longitude === '' && latitude !== '')
  ) {
    return res.status(400).json({ error: 'Both latitude and longitude must be provided together.' });
  }
  if (latitude != null && latitude !== '' && longitude != null && longitude !== '') {
    normalizedLatitude = readFiniteNumber(latitude);
    normalizedLongitude = readFiniteNumber(longitude);
    if (
      !Number.isFinite(normalizedLatitude) ||
      !Number.isFinite(normalizedLongitude) ||
      normalizedLatitude < -90 ||
      normalizedLatitude > 90 ||
      normalizedLongitude < -180 ||
      normalizedLongitude > 180
    ) {
      return res.status(400).json({ error: 'Latitude and longitude are outside their valid ranges.' });
    }
  }

  let normalizedResultsCount;
  if (resultsCount != null) {
    normalizedResultsCount = readFiniteNumber(resultsCount);
    if (normalizedResultsCount === null || !Number.isInteger(normalizedResultsCount) || normalizedResultsCount < 0) {
      return res.status(400).json({ error: 'Result count must be a non-negative integer.' });
    }
  }

  try {
    const entry = await SearchHistory.create({
      userId: req.user._id,
      location,
      city: req.body?.city?.trim() || undefined,
      state: req.body?.state?.trim() || undefined,
      country: req.body?.country?.trim() || undefined,
      category,
      mood,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      radius,
      resultsCount: normalizedResultsCount,
    });
    return res.status(201).json(entry);
  } catch (error) {
    return next(error);
  }
}

export async function deleteHistory(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.historyId)) {
    return res.status(400).json({ error: 'A valid search history ID is required.' });
  }

  try {
    const entry = await SearchHistory.findOneAndDelete({
      _id: req.params.historyId,
      userId: req.user._id,
    });
    if (!entry) return res.status(404).json({ error: 'Search history entry not found.' });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}
