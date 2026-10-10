import { Favourite } from '../models/Favourite.js';

const OSM_PLACE_ID = /^(node|way|relation)-\d+$/;

export async function listFavourites(req, res, next) {
  try {
    const favourites = await Favourite.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json(favourites);
  } catch (error) {
    return next(error);
  }
}

export async function addFavourite(req, res, next) {
  const place = req.body?.place;
  if (
    !place ||
    typeof place !== 'object' ||
    Array.isArray(place) ||
    typeof place.id !== 'string' ||
    !OSM_PLACE_ID.test(place.id) ||
    typeof place.name !== 'string' ||
    !place.name.trim() ||
    typeof place.latitude !== 'number' ||
    !Number.isFinite(place.latitude) ||
    Number(place.latitude) < -90 ||
    Number(place.latitude) > 90 ||
    typeof place.longitude !== 'number' ||
    !Number.isFinite(place.longitude) ||
    Number(place.longitude) < -180 ||
    Number(place.longitude) > 180 ||
    ['category', 'address', 'city', 'state', 'country', 'priceRange', 'image', 'description', 'openingHours', 'phone', 'website']
      .some((field) => place[field] != null && typeof place[field] !== 'string')
  ) {
    return res.status(400).json({ error: 'Valid place details are required.' });
  }
  const [osmType, osmId] = place.id.split('-');
  const placeSnapshot = {
    id: place.id,
    osmType,
    osmId,
    name: place.name.trim(),
    category: typeof place.category === 'string' ? place.category : 'place',
    address: place.address || null,
    city: place.city || null,
    state: place.state || null,
    country: place.country || null,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating == null ? null : place.rating,
    priceRange: place.priceRange || null,
    image: place.image || null,
    description: place.description || null,
    openingHours: place.openingHours || null,
    phone: place.phone || null,
    website: place.website || null,
    source: 'OpenStreetMap',
  };

  if (
    (placeSnapshot.rating !== null &&
      (typeof placeSnapshot.rating !== 'number' ||
        !Number.isFinite(placeSnapshot.rating) ||
        placeSnapshot.rating < 0 ||
        placeSnapshot.rating > 5)) ||
    (placeSnapshot.priceRange !== null &&
      !['₹', '₹₹', '₹₹₹', '₹₹₹₹'].includes(placeSnapshot.priceRange))
  ) {
    return res.status(400).json({ error: 'Place rating or price information is invalid.' });
  }

  try {
    const favourite = await Favourite.findOneAndUpdate(
      { userId: req.user._id, placeId: place.id },
      { $setOnInsert: { place: placeSnapshot } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(201).json(favourite);
  } catch (error) {
    if (error.code === 11000) {
      try {
        const existing = await Favourite.findOne({ userId: req.user._id, placeId: place.id });
        if (existing) return res.status(200).json(existing);
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    return next(error);
  }
}

export async function removeFavourite(req, res, next) {
  try {
    const favourite = await Favourite.findOneAndDelete({ userId: req.user._id, placeId: req.params.placeId });
    if (!favourite) {
      return res.status(404).json({ error: 'Favourite not found.' });
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}
