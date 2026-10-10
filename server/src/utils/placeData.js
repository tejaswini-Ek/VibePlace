import OpeningHours from 'opening_hours';
import tzLookup from 'tz-lookup';

export const MOOD_CATEGORIES = {
  chill: ['cafe', 'park', 'bookstore'],
  date: ['restaurant', 'cafe', 'cinema', 'theatre'],
  work: ['cafe', 'coworking', 'library'],
  shopping: ['mall', 'department_store', 'clothes'],
  'quick-bite': ['restaurant', 'fast_food', 'cafe'],
  'self-care': ['spa', 'beauty', 'fitness'],
  relax: ['cafe', 'park', 'bookstore'],
  outdoor: ['park', 'garden', 'playground'],
  indoor: ['cafe', 'museum', 'library'],
  study: ['library', 'cafe', 'coworking'],
  social: ['bar', 'restaurant', 'cafe', 'pub'],
  party: ['bar', 'restaurant', 'pub'],
};

export const OSM_CATEGORY_TAGS = {
  cafe: [['amenity', 'cafe']],
  park: [['leisure', 'park']],
  bookstore: [['shop', 'books']],
  restaurant: [['amenity', 'restaurant']],
  cinema: [['amenity', 'cinema']],
  theatre: [['amenity', 'theatre']],
  coworking: [['amenity', 'coworking_space']],
  library: [['amenity', 'library']],
  mall: [['shop', 'mall']],
  department_store: [['shop', 'department_store']],
  clothes: [['shop', 'clothes']],
  fast_food: [['amenity', 'fast_food']],
  spa: [['leisure', 'spa']],
  beauty: [['shop', 'beauty']],
  fitness: [['leisure', 'fitness_centre']],
  garden: [['leisure', 'garden']],
  playground: [['leisure', 'playground']],
  museum: [['tourism', 'museum']],
  bar: [['amenity', 'bar']],
  pub: [['amenity', 'pub']],
  hotel: [['tourism', 'hotel']],
};

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function haversineDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function categoriesForSearch(mood, category) {
  if (category && category !== 'all') {
    return OSM_CATEGORY_TAGS[category] ? [category] : [];
  }
  return MOOD_CATEGORIES[mood] || MOOD_CATEGORIES.relax;
}

export function getOpeningStatus(hours, latitude, longitude, address = {}) {
  const normalizedHours = typeof hours === 'string' ? hours.trim() : '';
  if (!normalizedHours || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'Unknown';

  const containsPublicHolidayRule = /\bPH\b/i.test(normalizedHours);
  if (containsPublicHolidayRule) {
    return 'Unknown';
  }

  try {
    const timezone = tzLookup(latitude, longitude);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const weekday = DAY_NAMES.indexOf(values.weekday.slice(0, 2));
    if (weekday < 0) return 'Unknown';

    const localPlaceTime = new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );

    const parser = new OpeningHours(normalizedHours, {
      lat: latitude,
      lon: longitude,
      address: {
        country_code: address.countryCode?.toLowerCase(),
        state: address.state,
      },
    });

    if (parser.getUnknown(localPlaceTime)) return 'Unknown';
    return parser.getState(localPlaceTime) ? 'Open' : 'Closed';
  } catch (error) {
    return 'Unknown';
  }
}

export function placeFromOverpass(element, center, address = {}) {
  const tags = element.tags || {};
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const matchedCategory = Object.entries(OSM_CATEGORY_TAGS).find(([, selectors]) =>
    selectors.some(([key, value]) => tags[key] === value),
  )?.[0];
  const category = matchedCategory || tags.amenity || tags.leisure || tags.shop || tags.tourism || 'place';
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const addressText =
    tags['addr:full'] ||
    [street, tags['addr:suburb'], tags['addr:city'] || address.city, tags['addr:state'] || address.state, tags['addr:country'] || address.country]
      .filter(Boolean)
      .join(', ');
  const ratingValue = tags.rating === undefined || tags.rating === null || tags.rating === ''
    ? null
    : Number(tags.rating);
  const rating = Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null;
  const priceLevels = {
    low: '₹',
    medium: '₹₹',
    high: '₹₹₹',
    very_high: '₹₹₹₹',
    '1': '₹',
    '2': '₹₹',
    '3': '₹₹₹',
    '4': '₹₹₹₹',
  };
  const priceRange = priceLevels[String(tags.price_level || tags.price_range || '').toLowerCase()] || null;
  const openingHours = typeof tags.opening_hours === 'string' ? tags.opening_hours.trim() || null : null;
  const rawImage = String(tags.image || '').trim();
  const wikimediaFile = String(tags.wikimedia_commons || '').trim();
  const wikimediaImage = /^File:/i.test(wikimediaFile)
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(wikimediaFile.slice(5))}`
    : null;
  const image = /^https?:\/\//i.test(rawImage) ? rawImage : wikimediaImage;
  const description = String(tags['description:en'] || tags.description || '').trim().slice(0, 600) || null;
  const openStatus = getOpeningStatus(openingHours, latitude, longitude, address);

  return {
    id: `${element.type}-${element.id}`,
    osmType: element.type,
    osmId: element.id,
    name: tags.name || 'Unnamed place',
    category,
    address: addressText || null,
    city: tags['addr:city'] || address.city || null,
    state: tags['addr:state'] || address.state || null,
    country: tags['addr:country'] || address.country || null,
    latitude,
    longitude,
    distanceKm: Number(haversineDistanceKm(center.latitude, center.longitude, latitude, longitude).toFixed(2)),
    rating,
    priceRange,
    image,
    description,
    openingHours,
    openStatus,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    source: 'OpenStreetMap',
  };
}
