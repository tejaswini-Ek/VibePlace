const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const requestOptions = {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    ...options,
  };

  if (requestOptions.signal === undefined) {
    delete requestOptions.signal;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, requestOptions);
  } catch (error) {
    if (path.startsWith('/api/places')) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Unable to connect to the place service. Check that the backend is running and try again.', { cause: error });
    }
    throw error;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || data?.error || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    error.code = data?.error?.code || data?.code || null;
    throw error;
  }

  return data;
}

export const api = {
  health: () => request('/health'),
  searchLocations: (query, signal) => request(`/api/locations/search?q=${encodeURIComponent(query)}`, { signal }),
  searchPlaces: (params, signal, page = 1) => {
    const values = {
      mood: params.mood || 'relax',
      category: params.category || 'all',
      radius: String(params.radius || 10),
      page: String(page),
    };
    if (params.location) values.location = params.location;
    if (params.latitude != null) values.latitude = String(params.latitude);
    if (params.longitude != null) values.longitude = String(params.longitude);
    if (params.city) values.city = params.city;
    if (params.state) values.state = params.state;
    if (params.country) values.country = params.country;
    if (params.countryCode) values.countryCode = params.countryCode;
    if (params.placeId) values.placeId = params.placeId;
    const qs = new URLSearchParams(values);
    return request(`/api/places?${qs.toString()}`, { signal });
  },
  getWeather: (latitude, longitude, signal) => request(`/api/weather?latitude=${latitude}&longitude=${longitude}`, { signal }),
  getRecommendations: (context, signal) => request('/api/recommendations', {
    method: 'POST',
    body: JSON.stringify(context),
    signal,
  }),
  checkAuth: () => request('/api/auth/me'),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  requestPasswordReset: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (payload) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getFavourites: () => request('/api/favourites'),
  addFavourite: (place) => request('/api/favourites', { method: 'POST', body: JSON.stringify({ place }) }),
  removeFavourite: (placeId) => request(`/api/favourites/${placeId}`, { method: 'DELETE' }),
  getHistory: () => request('/api/search-history'),
  addHistory: (payload) => request('/api/search-history', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHistory: (historyId) => request(`/api/search-history/${encodeURIComponent(historyId)}`, { method: 'DELETE' }),
};

export default api;
