const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'hamlet']);
const LOCALITY_TYPES = new Set(['suburb', 'neighbourhood', 'neighborhood', 'quarter', 'district', 'locality']);
const LOCALITY_FIELDS = ['locality', 'suburb', 'neighbourhood', 'neighborhood', 'quarter', 'district'];

function normalizeLocationPart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function locationType(properties = {}) {
  return String(properties.type || (properties.osm_key === 'place' ? properties.osm_value : '') || '').toLowerCase();
}

function localityMatch(properties = {}, queryParts) {
  const primaryPart = queryParts[0];
  const localityValues = [
    properties.name,
    ...LOCALITY_FIELDS.map((field) => properties[field]),
  ].map(normalizeLocationPart).filter(Boolean);
  const allValues = [
    ...localityValues,
    normalizeLocationPart(properties.city),
    normalizeLocationPart(properties.state),
    normalizeLocationPart(properties.country),
  ].filter(Boolean);

  if (primaryPart && localityValues.includes(primaryPart)) return 0;
  if (primaryPart && allValues.includes(primaryPart)) return 1;
  if (queryParts.slice(1).some((part) => localityValues.includes(part))) return 2;
  if (queryParts.slice(1).some((part) => allValues.includes(part))) return 3;

  const type = locationType(properties);
  if (CITY_TYPES.has(type)) return 4;
  if (LOCALITY_TYPES.has(type) || LOCALITY_FIELDS.some((field) => properties[field])) return 5;
  return 6;
}

export function locationFields(properties = {}) {
  const type = locationType(properties);
  return {
    city:
      properties.city ||
      (CITY_TYPES.has(type) ? properties.name : null),
    locality:
      LOCALITY_FIELDS.map((field) => properties[field]).find(Boolean) ||
      (LOCALITY_TYPES.has(type) ? properties.name : null),
    state: properties.state || null,
    country: properties.country || null,
    countryCode: properties.countrycode || null,
  };
}

export function prioritizeLocalities(features, query = '') {
  const seen = new Set();
  const uniqueFeatures = features.filter((feature) => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    const id = properties.osm_type && properties.osm_id
      ? `${properties.osm_type}-${properties.osm_id}`
      : feature.id || `${coordinates[0]}-${coordinates[1]}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const queryParts = String(query)
    .split(',')
    .map(normalizeLocationPart)
    .filter(Boolean);
  return uniqueFeatures
    .map((feature, index) => ({ feature, index, priority: localityMatch(feature.properties || {}, queryParts) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ feature }) => feature);
}
