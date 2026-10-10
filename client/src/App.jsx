import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Heart, MapPin, Menu, Sparkles, Sun, X, ArrowLeft, ArrowRight, LogOut, Bookmark, Clock3, Trash2, UserRound, Search, LocateFixed, Eye, EyeOff } from 'lucide-react';
import api from './api.js';

const moods = [
  { id: 'chill', title: 'Chill', sub: 'Quiet corners & calm', glyph: '01' },
  { id: 'date', title: 'Date', sub: 'Somewhere to linger', glyph: '02' },
  { id: 'work', title: 'Work', sub: 'A good place to focus', glyph: '03' },
  { id: 'shopping', title: 'Shopping', sub: 'Browse somewhere nearby', glyph: '04' },
  { id: 'quick-bite', title: 'Quick Bite', sub: 'Something good, quickly', glyph: '05' },
  { id: 'self-care', title: 'Self Care', sub: 'A little time for you', glyph: '06' },
  { id: 'relax', title: 'Relax', sub: 'Take the day slowly', glyph: '07' },
  { id: 'outdoor', title: 'Outdoor', sub: 'Get some fresh air', glyph: '08' },
  { id: 'indoor', title: 'Indoor', sub: 'Find a place inside', glyph: '09' },
  { id: 'study', title: 'Study', sub: 'Settle in and focus', glyph: '10' },
  { id: 'social', title: 'Social', sub: 'Meet, talk, and connect', glyph: '11' },
  { id: 'party', title: 'Party', sub: 'A little more lively', glyph: '12' },
];

function formatDistance(distanceKm) {
  if (distanceKm == null || distanceKm === '' || !Number.isFinite(Number(distanceKm))) return null;
  const distance = Number(distanceKm);
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
}

function hasCoordinates(place) {
  return place?.latitude != null &&
    place?.longitude != null &&
    Number.isFinite(Number(place.latitude)) &&
    Number.isFinite(Number(place.longitude)) &&
    Number(place.latitude) >= -90 &&
    Number(place.latitude) <= 90 &&
    Number(place.longitude) >= -180 &&
    Number(place.longitude) <= 180;
}

function externalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function ProfileAvatar({ user, large = false }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [user?.profileImage]);

  return (
    <span className={`profile-avatar${large ? ' large' : ''}`} aria-hidden="true">
      {user?.profileImage && !imageFailed ? (
        <img
          src={user.profileImage}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <UserRound size={large ? 26 : 18} />
      )}
    </span>
  );
}

const mapIcon = (color = '#3f6a57') =>
  new L.DivIcon({
    className: 'mood-map-pin',
    html: `<span style="background:${color};color:white;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;box-shadow:0 8px 20px rgba(0,0,0,0.2);font-size:11px;border:2px solid white;">●</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });

function MapPanel({ center, places = [] }) {
  if (!hasCoordinates(center)) {
    return <div className="empty-state map-unavailable">Map location is unavailable for these places.</div>;
  }
  const position = [Number(center.latitude), Number(center.longitude)];

  return (
    <div className="map-panel">
      <MapContainer center={position} zoom={12} scrollWheelZoom={false} className="map-frame">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.filter(hasCoordinates).map((place) => (
          <Marker key={place.id} position={[Number(place.latitude), Number(place.longitude)]} icon={mapIcon()}>
            <Popup>
              <strong>{place.name}</strong><br />
              {place.category}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default function App() {
  return (
    <div className="shell">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/places" component={Results} />
        <Route path="/place/:id" component={PlaceDetail} />
        <Route path="/login" component={() => <AuthPage mode="login" />} />
        <Route path="/register" component={() => <AuthPage mode="register" />} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/favourites" component={Favourites} />
        <Route path="/profile" component={Profile} />
        <Route path="/search-history" component={SearchHistory} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function Shell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['me'],
    queryFn: api.checkAuth,
    retry: false,
    staleTime: 30000,
  });
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    staleTime: 60000,
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      refetchUser();
      navigate('/');
    },
  });

  const links = [
    { href: '/', text: 'Explore' },
    { href: '/favourites', text: 'Saved places' },
    { href: '/search-history', text: 'Recent searches' },
  ];

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Mood Place home">
            <span className="brand-mark"><Compass size={20} /></span>
            <span className="brand-copy">
              <span className="brand-title">mood place</span>
              <span className="brand-subtitle">find your somewhere</span>
            </span>
          </Link>

          <nav className="desktop-links" aria-label="Main navigation">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={(item.href === '/' ? location === '/' || location.startsWith('/places') || location.startsWith('/place/') : location.startsWith(item.href)) ? 'nav-link active' : 'nav-link'}
              >
                {item.text}
              </Link>
            ))}
          </nav>

          <div className="desktop-actions">
            <span className="status-pill" title={health?.status || 'Checking place guide'} aria-label={health?.status || 'Checking place guide'}>
              <span className={`status-dot ${health?.status === 'ok' ? 'ok' : 'warn'}`} />
              {health ? 'Place guide' : 'Checking'}
            </span>
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="profile-chip"
                  aria-label="View profile"
                  title={user.name ? `${user.name}'s profile` : 'View profile'}
                >
                  <ProfileAvatar user={user} />
                </Link>
                <button className="icon-button" onClick={() => logoutMutation.mutate()} aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link plain">Sign in</Link>
                <Link href="/register" className="join-btn">Join for free</Link>
              </>
            )}
          </div>

          <button className="mobile-menu" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="mobile-menu-panel">
            {[...links, ...(user ? [{ href: '/profile', text: 'My profile' }] : [{ href: '/login', text: 'Sign in' }, { href: '/register', text: 'Create account' }])].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="mobile-link">
                {item.text}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>
            <span className="footer-brand">mood place</span>
            <span className="bullet">·</span>
            Good places for the way you feel.
          </p>
          <p>Places sourced from OpenStreetMap contributors.</p>
        </div>
      </footer>
    </div>
  );
}

function Home() {
  const [, navigate] = useLocation();
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [radius, setRadius] = useState('10');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mood, setMood] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const locationQuery = [customCity.trim(), city.trim(), state.trim(), country.trim()]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(', ');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(locationQuery);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  const suggestionsQuery = useQuery({
    queryKey: ['locations', debouncedQuery],
    queryFn: ({ signal }) => api.searchLocations(debouncedQuery, signal),
    enabled: debouncedQuery.length >= 2 && !selectedLocation,
    staleTime: 30000,
    retry: 1,
  });

  const suggestions = suggestionsQuery.data || [];
  const suggestionsMatchCurrentInput = debouncedQuery === locationQuery;
  const selectedMood = moods.find((item) => item.id === mood);

  const locateUser = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('This browser does not support location detection. Enter a location manually instead.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setUseCurrentLocation(true);
        setRadius('10');
        setIsLocating(false);
        setSearchError('');
      },
      (error) => {
        setIsLocating(false);
        setGpsError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can continue by entering a location manually.'
            : error.code === error.TIMEOUT
              ? 'Location detection timed out. Try again or enter a location manually.'
              : 'Your current position is unavailable. Try again or enter a location manually.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const submit = (event) => {
    event.preventDefault();
    if (isSearching) return;
    if (!mood) {
      setSearchError('Choose a vibe before searching.');
      return;
    }
    const countryValue = country.trim();
    const stateValue = state.trim();
    const localityValue = customCity.trim();
    const cityValue = city.trim();
    if (!useCurrentLocation && !countryValue) {
      setSearchError('Enter a country before searching.');
      return;
    }
    setSearchError('');

    const manualLocation = [localityValue, cityValue, stateValue, countryValue]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(', ');
    const location = useCurrentLocation
      ? 'Current GPS location'
      : manualLocation || selectedLocation?.displayName || '';
    const coordinates = useCurrentLocation ? gpsCoordinates : selectedLocation;
    setIsSearching(true);
    const payload = {
      location,
      category: 'all',
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      city: cityValue,
      state: stateValue,
      country: countryValue,
      countryCode: useCurrentLocation ? '' : selectedLocation?.countryCode ?? '',
    };

    const params = new URLSearchParams({
      location: payload.location,
      mood,
      category: payload.category,
      radius,
    });

    if (payload.latitude != null && payload.longitude != null) {
      params.set('latitude', String(payload.latitude));
      params.set('longitude', String(payload.longitude));
    }
    if (payload.city) params.set('city', payload.city);
    if (payload.state) params.set('state', payload.state);
    if (payload.country) params.set('country', payload.country);
    if (payload.countryCode) params.set('countryCode', payload.countryCode);
    if (useCurrentLocation) params.set('locationMode', 'gps');

    navigate(`/places?${params.toString()}`);
  };

  return (
    <Shell>
      <div className="discover-page">
        <header className="discover-intro">
          <p className="eyebrow"><Sparkles size={15} /> Discover somewhere for today</p>
          <h1>Find your next <em>favorite place.</em></h1>
          <p>Choose your vibe, pick a location, and find places that fit your day.</p>
        </header>

        <section className="discovery-step" aria-labelledby="mood-step-heading">
          <div className="step-heading">
            <span className="step-number">01</span>
            <div>
              <p className="step-kicker">Start with a feeling</p>
              <h2 id="mood-step-heading">What's your vibe today?</h2>
            </div>
          </div>
          <div className="mood-grid" role="group" aria-label="Select one mood or vibe">
            {moods.map((item) => (
              <button
                key={item.id}
                type="button"
                className={mood === item.id ? 'mood-card active' : 'mood-card'}
                onClick={() => {
                  setMood(item.id);
                  setSearchError('');
                }}
                aria-pressed={mood === item.id}
              >
                <span className="mood-glyph">{item.glyph}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <form className="search-card" onSubmit={submit} noValidate>
          <div className="step-heading">
            <span className="step-number">02</span>
            <div>
              <p className="step-kicker">Choose where to look</p>
              <h2>Your location</h2>
            </div>
          </div>
          <div className="location-mode-row">
            <button type="button" className={useCurrentLocation ? 'location-mode active' : 'location-mode'} onClick={locateUser} disabled={isLocating}>
              <LocateFixed size={17} />
              {isLocating ? 'Finding your location…' : 'Use my current location'}
            </button>
            {useCurrentLocation && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setUseCurrentLocation(false);
                  setRadius(customCity.trim() ? '3' : '10');
                  setGpsError('');
                }}
              >
                Use manual location
              </button>
            )}
          </div>
          {useCurrentLocation && <p className="location-status" role="status">Searches will be centered on your current GPS location.</p>}
          {gpsError && <p className="error-text" role="alert">{gpsError}</p>}

          <div className={`location-fields${useCurrentLocation ? ' location-fields-muted' : ''}`}>
            <label className="location-field">
              <span>Country{!useCurrentLocation && <b aria-hidden="true"> *</b>}</span>
              <input
                required={!useCurrentLocation}
                maxLength={100}
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setState('');
                  setCity('');
                  setCustomCity('');
                  setSelectedLocation(null);
                  setUseCurrentLocation(false);
                  setSearchError('');
                }}
                placeholder="Enter country"
                autoComplete="country-name"
                disabled={useCurrentLocation}
              />
            </label>
            <label className="location-field">
              <span>State</span>
              <input
                maxLength={100}
                value={state}
                onChange={(event) => {
                  setState(event.target.value);
                  setCity('');
                  setSelectedLocation(null);
                  setUseCurrentLocation(false);
                  setSearchError('');
                }}
                placeholder="Enter state"
                autoComplete="address-level1"
                disabled={useCurrentLocation}
              />
            </label>
            <label className="location-field">
              <span>City</span>
              <input
                maxLength={100}
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setSelectedLocation(null);
                  setUseCurrentLocation(false);
                  setSearchError('');
                }}
                placeholder="Enter city"
                autoComplete="address-level2"
                disabled={useCurrentLocation}
              />
            </label>
            <label className="location-field custom-city-field">
              <span>Neighborhood / Colony / Nagar</span>
              <input
                maxLength={100}
                value={customCity}
                onChange={(event) => {
                  setCustomCity(event.target.value);
                  if (!customCity.trim() && event.target.value.trim()) setRadius('3');
                  if (!event.target.value.trim()) setRadius('10');
                  setSelectedLocation(null);
                  setUseCurrentLocation(false);
                  setSearchError('');
                }}
                placeholder="e.g. Kothrud, Shivajinagar"
                autoComplete="off"
                disabled={useCurrentLocation}
              />
              <small>Enter the area name; add its city above for a closer match.</small>
            </label>
          </div>
          <div className="search-radius-row">
            <label className="location-field search-radius-field">
              <span>Search radius</span>
              <select value={radius} onChange={(event) => setRadius(event.target.value)} disabled={useCurrentLocation}>
                <option value="1">Within 1 km</option>
                <option value="2">Within 2 km</option>
                <option value="3">Within 3 km</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="20">Within 20 km</option>
              </select>
              <small>Area searches start at 3 km and center on the matched locality.</small>
            </label>
          </div>

          {suggestionsMatchCurrentInput && suggestions.length > 0 && !selectedLocation && !useCurrentLocation && (
            <div className="suggestions-panel" role="listbox" aria-label="Location suggestions">
              {suggestions.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="suggestion-item"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    const localityName = item.locality || (customCity.trim() ? item.name : '');
                    setCustomCity(localityName);
                    setCity(item.city || (localityName ? city : item.name));
                    setState(item.state || '');
                    setCountry(item.country || country);
                    setRadius(localityName ? '3' : '10');
                    setSelectedLocation(item);
                  }}
                >
                  <MapPin size={15} />
                  <span><strong>{item.name}</strong><small>{item.displayName}</small></span>
                </button>
              ))}
            </div>
          )}
          {suggestionsMatchCurrentInput && suggestionsQuery.isFetching && debouncedQuery.length >= 2 && !selectedLocation && !useCurrentLocation && (
            <p className="subtle-message" role="status">Finding location suggestions…</p>
          )}
          {suggestionsMatchCurrentInput && suggestionsQuery.isError && debouncedQuery.length >= 2 && !useCurrentLocation && (
            <p className="subtle-message">Suggestions are unavailable. You can still search using the location entered.</p>
          )}
          {searchError && <p className="error-text" role="alert">{searchError}</p>}

          <div className="search-submit-row">
            <span className="search-submit-label"><span className="step-number">03</span> Ready to explore?</span>
            <button type="submit" className="find-btn" disabled={isSearching || isLocating}>
              <Search size={17} /> {isSearching ? 'Searching…' : 'Search Places'}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function Results() {
  const params = new URLSearchParams(window.location.search);
  const location = params.get('location') || '';
  const mood = params.get('mood') || 'relax';
  const category = params.get('category') || 'all';
  const locationMode = params.get('locationMode') || 'manual';
  const city = params.get('city') || '';
  const state = params.get('state') || '';
  const country = params.get('country') || '';
  const countryCode = params.get('countryCode') || '';
  const requestedRadius = Number(params.get('radius') || 10);
  const radius = Number.isFinite(requestedRadius) ? Math.min(Math.max(requestedRadius, 1), 20) : 10;
  const latValue = params.get('latitude');
  const lonValue = params.get('longitude');
  const latitude = latValue !== null && latValue !== '' ? Number(latValue) : undefined;
  const longitude = lonValue !== null && lonValue !== '' ? Number(lonValue) : undefined;
  const [filters, setFilters] = useState({
    distance: 'all',
    rating: 'all',
    category: 'all',
    status: 'all',
    price: 'all',
    search: '',
    sort: 'distance',
  });

  const placeQuery = useInfiniteQuery({
    queryKey: ['places', { location, mood, category, radius, latitude, longitude, city, state, country, countryCode }],
    queryFn: ({ signal, pageParam }) => api.searchPlaces({
      location,
      mood,
      category,
      radius,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      city,
      state,
      country,
      countryCode,
    }, signal, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: Boolean(location),
  });

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.checkAuth,
    retry: false,
    staleTime: 30000,
  });
  const saveHistory = useMutation({ mutationFn: api.addHistory });
  const savedHistorySearch = useRef(null);
  const searchSignature = JSON.stringify({
    location,
    mood,
    category,
    radius,
    latitude,
    longitude,
    city,
    state,
    country,
    countryCode,
  });
  useEffect(() => {
    const firstPage = placeQuery.data?.pages[0];
    if (!user || !placeQuery.isSuccess || !firstPage || savedHistorySearch.current === searchSignature) return;

    savedHistorySearch.current = searchSignature;
    saveHistory.mutate(
      {
        location,
        mood,
        category,
        city,
        state,
        country,
        radius,
        resultsCount: firstPage.total,
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
      },
      { onError: () => console.warn('History save failed') },
    );
  }, [
    user,
    placeQuery.isSuccess,
    placeQuery.data,
    searchSignature,
    location,
    mood,
    category,
    city,
    state,
    country,
    countryCode,
    radius,
    latitude,
    longitude,
  ]);

  const items = placeQuery.data?.pages.flatMap((page) => page.items) || [];
  const totalPlaces = placeQuery.data?.pages[0]?.total || 0;
  const weatherLatitude = placeQuery.data?.pages[0]?.centerLatitude ?? latitude;
  const weatherLongitude = placeQuery.data?.pages[0]?.centerLongitude ?? longitude;
  const hasWeatherCoordinates =
    weatherLatitude != null &&
    weatherLongitude != null &&
    Number.isFinite(Number(weatherLatitude)) &&
    Number.isFinite(Number(weatherLongitude));

  const weatherQuery = useQuery({
    queryKey: ['weather', weatherLatitude, weatherLongitude],
    queryFn: ({ signal }) => api.getWeather(Number(weatherLatitude), Number(weatherLongitude), signal),
    enabled: Boolean(placeQuery.data && hasWeatherCoordinates),
    retry: 1,
  });

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', location, mood, items.slice(0, 3).map((place) => place.id), weatherQuery.data?.condition, weatherQuery.data?.temperatureC],
    queryFn: ({ signal }) => api.getRecommendations({
      mood,
      location,
      places: items.slice(0, 3),
      weather: weatherQuery.data || null,
    }, signal),
    enabled: items.length > 0 && (!hasWeatherCoordinates || weatherQuery.isFetched),
    retry: false,
  });

  const favouritesQuery = useQuery({
    queryKey: ['favourites'],
    queryFn: api.getFavourites,
    retry: false,
  });

  const queryClient = useQueryClient();

  const addFavourite = useMutation({
    mutationFn: api.addFavourite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favourites'] }),
  });

  const removeFavourite = useMutation({
    mutationFn: (placeId) => api.removeFavourite(placeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favourites'] }),
  });

  const moodName = moods.find((m) => m.id === mood)?.title || 'Find your mood';
  const hasRatings = items.some((place) => Number.isFinite(place.rating));
  const hasPrices = items.some((place) => Boolean(place.priceRange));
  const filteredPlaces = items.filter((place) => {
    if (filters.distance === 'near' && (!Number.isFinite(place.distanceKm) || place.distanceKm > 2)) return false;
    if (filters.distance === '2-5' && (!Number.isFinite(place.distanceKm) || place.distanceKm < 2 || place.distanceKm > 5)) return false;
    if (filters.distance === '5-10' && (!Number.isFinite(place.distanceKm) || place.distanceKm < 5 || place.distanceKm > 10)) return false;
    if (filters.rating !== 'all' && (!Number.isFinite(place.rating) || place.rating < Number(filters.rating))) return false;
    if (filters.category !== 'all' && place.category !== filters.category) return false;
    if (filters.status !== 'all' && place.openStatus !== filters.status) return false;
    if (filters.price !== 'all' && place.priceRange !== filters.price) return false;
    if (filters.search && !`${place.name} ${place.address || ''} ${place.category || ''}`.toLowerCase().includes(filters.search.trim().toLowerCase())) return false;
    return true;
  }).sort((left, right) => {
    if (filters.sort === 'name') return left.name.localeCompare(right.name);
    if (filters.sort === 'rating') return (right.rating ?? -1) - (left.rating ?? -1);
    if (!Number.isFinite(left.distanceKm)) return 1;
    if (!Number.isFinite(right.distanceKm)) return -1;
    return left.distanceKm - right.distanceKm;
  });

  const isSaved = (place) => favouritesQuery.data?.some((f) => f.place?.id === place.id || f.placeId === place.id);

  const toggleSave = (place) => {
    if (isSaved(place)) {
      removeFavourite.mutate(place.id);
    } else {
      addFavourite.mutate(place);
    }
  };

  return (
    <Shell>
      <div className="results-wrap">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Change your search
        </Link>

        <div className="results-header">
          <div>
            <p className="kicker">A good match for</p>
            <h1>{moodName}</h1>
            <p className="location-line"><MapPin size={14} /> {locationMode === 'gps' || location === 'Current GPS location' ? 'Your current GPS location' : location || [city, state, country].filter(Boolean).join(', ')} · {category === 'all' ? 'all place types' : category.replaceAll('_', ' ')}</p>
          </div>
          <div className="chips-row">
            {weatherQuery.data && !weatherQuery.isError && (
              <span className="result-chip accent">
                <Sun size={14} /> {weatherQuery.data.temperatureC}° · {weatherQuery.data.condition}
              </span>
            )}
            <span className="result-chip">{filteredPlaces.length} shown · {totalPlaces} found</span>
          </div>
        </div>

        {weatherQuery.isError && <div className="hint-box">Weather information unavailable.</div>}
        {recommendationsQuery.data?.recommendation && (
          <div className="hint-box">
            <Sparkles size={15} /> {recommendationsQuery.data.recommendation}
          </div>
        )}
        {recommendationsQuery.data?.reason && <p className="recommendation-reason">{recommendationsQuery.data.reason}</p>}

        {weatherQuery.data && (
          <section className="weather-summary" aria-label="Local weather">
            <div>
              <strong>{weatherQuery.data.temperatureC}°C · {weatherQuery.data.condition}</strong>
              <span>Humidity {weatherQuery.data.humidityPercent ?? 'Not available'}%</span>
              <span>Wind {weatherQuery.data.windSpeedKmh ?? 'Not available'} km/h</span>
            </div>
            {weatherQuery.data.daily?.slice(0, 2).map((day) => (
              <span className="weather-day" key={day.date}>
                {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}: {day.lowC ?? '—'}°–{day.highC ?? '—'}°
              </span>
            ))}
          </section>
        )}

        {placeQuery.isLoading ? (
          <div className="card-grid loading-grid">
            {[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="place-card skeleton" />)}
          </div>
        ) : placeQuery.isError ? (
          <div className="empty-state">
            <h3>{formatServerError(placeQuery.error)}</h3>
            <button className="primary-btn" onClick={() => placeQuery.refetch()}>Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing nearby yet</h3>
            <p>{placeQuery.data?.pages?.[0]?.message || 'Try another neighbourhood or broaden the kind of place you’re after.'}</p>
            <Link href="/" className="primary-btn inline-link">Try a new search</Link>
          </div>
        ) : (
          <>
            <div className="place-filters" aria-label="Filter places">
              <label className="filter-search">Search results
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  placeholder="Name, type, or address"
                />
              </label>
              <label>Distance
                <select value={filters.distance} onChange={(event) => setFilters({ ...filters, distance: event.target.value })}>
                  <option value="all">Any distance</option>
                  <option value="near">Near · under 2 km</option>
                  <option value="2-5">2–5 km</option>
                  <option value="5-10">5–10 km</option>
                </select>
              </label>
              {hasRatings && <label>Rating
                <select value={filters.rating} onChange={(event) => setFilters({ ...filters, rating: event.target.value })}>
                  <option value="all">Any rating</option>
                  <option value="4">4+ stars</option>
                  <option value="3">3+ stars</option>
                </select>
              </label>}
              <label>Place type
                <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                  <option value="all">All types</option>
                  {[...new Set(items.map((place) => place.category))].sort().map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label>Open status
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <option value="all">Any status</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Unknown">Hours unavailable</option>
                </select>
              </label>
              {hasPrices && <label>Price
                <select value={filters.price} onChange={(event) => setFilters({ ...filters, price: event.target.value })}>
                  <option value="all">Any price</option>
                  <option value="₹">Budget</option>
                  <option value="₹₹">Moderate</option>
                  <option value="₹₹₹">Expensive</option>
                  <option value="₹₹₹₹">Premium</option>
                </select>
              </label>}
              <label>Sort by
                <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
                  <option value="distance">Distance</option>
                  {hasRatings && <option value="rating">Rating</option>}
                  <option value="name">Name</option>
                </select>
              </label>
              <button type="button" className="text-button clear-filters" onClick={() => setFilters({ distance: 'all', rating: 'all', category: 'all', status: 'all', price: 'all', search: '', sort: 'distance' })}>Clear filters</button>
            </div>
            <div className="map-section">
              <MapPanel center={{ latitude: weatherLatitude, longitude: weatherLongitude }} places={filteredPlaces} />
            </div>
            {filteredPlaces.length > 0 ? (
              <>
                <div className="card-grid">
                  {filteredPlaces.map((place, index) => (
                    <PlaceCard key={place.id} place={place} index={index} saved={isSaved(place)} onSave={() => toggleSave(place)} query={params.toString()} />
                  ))}
                </div>
                {placeQuery.hasNextPage && (
                  <div className="load-more-wrap">
                    <button type="button" className="secondary-btn" onClick={() => placeQuery.fetchNextPage()} disabled={placeQuery.isFetchingNextPage}>
                      {placeQuery.isFetchingNextPage ? 'Loading more places…' : 'Load more places'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state"><h3>No places match these filters</h3><p>Adjust or clear a filter to see more results.</p></div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function PlaceCard({ place, index, saved, onSave, query }) {
  const art = ['sand', 'rose', 'sage', 'cream', 'mist', 'beige'];
  const params = new URLSearchParams(query);

  return (
    <article className="place-card" data-testid={`card-place-${place.id}`}>
      <PlaceArtwork place={place} className={`card-visual ${art[index % art.length]}`}>
        <span className="tag-pill">{place.category}</span>
        <button type="button" className={saved ? 'save-btn active' : 'save-btn'} onClick={onSave} aria-label={saved ? 'Remove from saved places' : 'Save place'}>
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </PlaceArtwork>

      <div className="card-body">
        <div className="card-head">
          <h2>{place.name}</h2>
          {formatDistance(place.distanceKm) && <span>{formatDistance(place.distanceKm)} away</span>}
        </div>

        <p>{place.address || [place.city, place.state].filter(Boolean).join(', ') || 'Address not listed'}</p>
        {place.description && <p className="place-description">{place.description}</p>}

        <div className="place-data-row">
          {place.rating != null && <span>{place.rating} / 5</span>}
          {place.priceRange && <span>{place.priceRange}</span>}
          {['Open', 'Closed'].includes(place.openStatus) && <span>{formatPlaceStatus(place.openStatus)}</span>}
        </div>

        <div className="card-actions">
          <span><MapPin size={13} /> {[place.city, place.state, place.country].filter(Boolean).join(', ') || 'Location details not available'}</span>
          {directionsUrl(place) && <a href={directionsUrl(place)} className="detail-link" target="_blank" rel="noreferrer">Directions <ArrowRight size={15} /></a>}
          <Link href={`/place/${encodeURIComponent(place.id)}?${params.toString()}`} className="detail-link">
            See place <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function PlaceArtwork({ place, className, children }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className={className}>
      {place.image && !imageFailed ? (
        <img
          src={place.image}
          alt={place.name ? `${place.name} photo` : 'Place photo'}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="initial-badge" aria-label="Photo not available">{place.name?.charAt(0)?.toUpperCase() || 'P'}</span>
      )}
      {children}
    </div>
  );
}

function formatPlaceStatus(status) {
  if (status === 'Open') return 'Open now';
  if (status === 'Closed') return 'Closed';
  return 'Hours unavailable';
}

function formatServerError(error) {
  if (error?.status === 400) return 'Please check the location and category before searching again.';
  if (error?.status === 502) return 'Place service is temporarily unavailable. Please try again.';
  return error?.message || 'Something went wrong while searching for places.';
}

function directionsUrl(place) {
  if (!hasCoordinates(place)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
}

function PlaceDetail() {
  const { id } = useParams();
  const search = new URLSearchParams(window.location.search);
  const location = search.get('location') || '';
  const mood = search.get('mood') || 'relax';
  const category = search.get('category') || 'all';
  const city = search.get('city') || '';
  const state = search.get('state') || '';
  const country = search.get('country') || '';
  const countryCode = search.get('countryCode') || '';
  const latValue = search.get('latitude');
  const lonValue = search.get('longitude');
  const latitude = latValue !== null && latValue !== '' ? Number(latValue) : undefined;
  const longitude = lonValue !== null && lonValue !== '' ? Number(lonValue) : undefined;

  const placeQuery = useQuery({
    queryKey: ['place-detail', id, { location, mood, category, latitude, longitude, city, state, country, countryCode }],
    queryFn: ({ signal }) => api.searchPlaces({
      location,
      mood,
      category,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      city,
      state,
      country,
      countryCode,
      placeId: id,
    }, signal),
    enabled: Boolean(location),
  });

  const selected = placeQuery.data?.items?.find((place) => String(place.id) === String(id)) || null;
  const queryClient = useQueryClient();
  const weatherQuery = useQuery({
    queryKey: ['weather', selected?.latitude, selected?.longitude],
    queryFn: () => api.getWeather(selected.latitude, selected.longitude),
    enabled: Boolean(selected && Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)),
    retry: 1,
  });
  const hasSelectedCoordinates =
    Number.isFinite(selected?.latitude) && Number.isFinite(selected?.longitude);
  const recommendationQuery = useQuery({
    queryKey: ['place-recommendation', selected?.id, mood, weatherQuery.data?.condition, weatherQuery.data?.temperatureC],
    queryFn: () => api.getRecommendations({ mood, location, places: [selected], weather: weatherQuery.data || null }),
    enabled: Boolean(selected && (!hasSelectedCoordinates || weatherQuery.isFetched)),
    retry: false,
  });
  const favouritesQuery = useQuery({
    queryKey: ['favourites'],
    queryFn: api.getFavourites,
    retry: false,
  });
  const isSaved = Boolean(selected && favouritesQuery.data?.some((entry) => entry.placeId === selected.id || entry.place?.id === selected.id));
  const saveMutation = useMutation({
    mutationFn: (place) => isSaved ? api.removeFavourite(place.id) : api.addFavourite(place),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favourites'] }),
  });
  const [shareMessage, setShareMessage] = useState('');
  const savePlace = () => {
    setShareMessage('');
    saveMutation.mutate(selected);
  };
  const sharePlace = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: selected.name, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
      setShareMessage('Place link copied or shared.');
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Unable to share this place from the current browser.');
    }
  };
  const website = externalUrl(selected?.website);
  const selectedDirectionsUrl = selected ? directionsUrl(selected) : null;

  return (
    <Shell>
      <div className="detail-layout">
        <Link href={location ? `/places?${window.location.search.slice(1)}` : '/'} className="back-link">
          <ArrowLeft size={16} /> Back to results
        </Link>

        {placeQuery.isLoading ? (
          <div className="empty-state" role="status"><h3>Loading place details…</h3></div>
        ) : placeQuery.isError ? (
          <div className="empty-state" role="alert">
            <h3>{formatServerError(placeQuery.error)}</h3>
            <button className="primary-btn" type="button" onClick={() => placeQuery.refetch()}>Try again</button>
          </div>
        ) : !selected ? (
          <div className="empty-state"><h3>Place details unavailable.</h3></div>
        ) : (
          <>
            <div className="detail-card">
              <PlaceArtwork place={selected} className="detail-visual" />
              <div className="detail-content">
                <div className="detail-header">
                  <div>
                    <p className="kicker">{selected.category}</p>
                    <h1>{selected.name}</h1>
                  </div>
                  <button type="button" className="primary-btn small" onClick={savePlace} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : isSaved ? 'Remove saved' : 'Save place'}
                  </button>
                </div>
                <p className="detail-location"><MapPin size={14} /> {selected.address || [selected.city, selected.state, selected.country].filter(Boolean).join(', ')}</p>
                <div className="detail-meta">
                  {formatDistance(selected.distanceKm) && <span>{formatDistance(selected.distanceKm)} away</span>}
                  {selected.rating != null && <span>{selected.rating} / 5</span>}
                  {selected.priceRange && <span>{selected.priceRange}</span>}
                  {['Open', 'Closed'].includes(selected.openStatus) && <span>{formatPlaceStatus(selected.openStatus)}</span>}
                </div>
                {selected.description && <p className="detail-description">{selected.description}</p>}
              </div>
            </div>
            {(saveMutation.isError || favouritesQuery.isError) && (
              <p className="error-text" role="alert">Sign in to save places, or check that the server is connected.</p>
            )}
            {shareMessage && <p className="hint-box" role="status">{shareMessage}</p>}
            <section className="detail-actions" aria-label="Place actions">
              {selectedDirectionsUrl && <a className="primary-btn small" href={selectedDirectionsUrl} target="_blank" rel="noreferrer">Get directions</a>}
              <button className="secondary-btn" type="button" onClick={sharePlace}>Share place</button>
              {website && <a className="secondary-btn" href={website} target="_blank" rel="noreferrer">Website</a>}
              {selected.phone && <a className="secondary-btn" href={`tel:${encodeURIComponent(selected.phone)}`}>Call</a>}
            </section>
            <div className="detail-map">
              <MapPanel center={{ latitude: selected.latitude, longitude: selected.longitude }} places={[selected]} />
            </div>
            <section className="detail-info-grid">
              {(selected.openingHours || ['Open', 'Closed'].includes(selected.openStatus)) && <div className="info-panel">
                <h2>Hours</h2>
                {selected.openingHours && <p>{selected.openingHours}</p>}
                {['Open', 'Closed'].includes(selected.openStatus) && <strong>Current status: {formatPlaceStatus(selected.openStatus)}</strong>}
              </div>}
              <div className="info-panel">
                <h2>Weather nearby</h2>
                {weatherQuery.isLoading ? <p>Loading local weather…</p> : weatherQuery.isError ? (
                  <p>Weather information unavailable.</p>
                ) : weatherQuery.data ? (
                  <>
                    <p>{weatherQuery.data.temperatureC}°C · {weatherQuery.data.condition}</p>
                    <p>Humidity: {weatherQuery.data.humidityPercent ?? 'Not available'}%</p>
                    <p>Wind: {weatherQuery.data.windSpeedKmh ?? 'Not available'} km/h</p>
                    <div className="forecast-row">
                      {weatherQuery.data.hourly?.slice(0, 4).map((hour) => (
                        <span key={hour.time}>{new Date(hour.time).toLocaleTimeString([], { hour: 'numeric' })}: {hour.temperatureC ?? '—'}°</span>
                      ))}
                    </div>
                  </>
                ) : <p>Weather information unavailable.</p>}
              </div>
            </section>
            <section className="info-panel recommendation-panel">
              <h2>Why it may fit your mood</h2>
              {recommendationQuery.isLoading ? <p>Putting together a recommendation…</p> : recommendationQuery.isError ? (
                <p>AI recommendation is temporarily unavailable.</p>
              ) : recommendationQuery.data?.recommendation ? (
                <>
                  <p>{recommendationQuery.data.recommendation}</p>
                  {recommendationQuery.data.reason && <p>{recommendationQuery.data.reason}</p>}
                  {recommendationQuery.data.weatherSuitability && <p>{recommendationQuery.data.weatherSuitability}</p>}
                </>
              ) : <p>{recommendationQuery.data?.reason || 'AI recommendations are not configured.'}</p>}
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Favourites() {
  const queryClient = useQueryClient();
  const { data = [], error, isLoading } = useQuery({ queryKey: ['favourites'], queryFn: api.getFavourites, retry: false });
  const removeMutation = useMutation({
    mutationFn: api.removeFavourite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favourites'] }),
  });

  return (
    <Shell>
      <div className="page-panel">
        <div className="panel-heading">
          <div>
            <p className="kicker">Your collection</p>
            <h1>Saved places</h1>
            {!isLoading && !error && <p className="page-summary">{data.length} {data.length === 1 ? 'place' : 'places'} saved</p>}
          </div>
          <Bookmark size={18} />
        </div>

        {isLoading ? <p>Loading saved places…</p> : error ? (
          <div className="empty-state"><h3>Sign in to view saved places</h3><Link href="/login" className="primary-btn inline-link">Sign in</Link></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><h3>Your collection starts here</h3><p>Save a place you like and it will be easy to find again.</p><Link href="/" className="primary-btn inline-link">Explore places</Link></div>
        ) : (
          <div className="card-grid saved-grid">
            {data.map((entry) => {
              const place = entry.place || entry;
              return (
                <article className="place-card saved-place-card" key={entry._id || entry.placeId || entry.id}>
                  <PlaceArtwork place={place} className="card-visual">
                    <span className="tag-pill">{place.category || 'Place'}</span>
                  </PlaceArtwork>
                  <div className="card-body">
                    <div className="card-head"><h2>{place.name || 'Saved place'}</h2></div>
                    <p>{place.address || [place.city, place.state, place.country].filter(Boolean).join(', ') || 'Address not listed'}</p>
                    <div className="card-actions">
                      {directionsUrl(place) && (
                        <a className="detail-link" href={directionsUrl(place)} target="_blank" rel="noreferrer">Directions <ArrowRight size={15} /></a>
                      )}
                      {place.id && <Link className="detail-link" href={savedPlaceDetailsUrl(place)}>View details <ArrowRight size={15} /></Link>}
                      <button type="button" className="text-button remove-saved" onClick={() => removeMutation.mutate(entry.placeId || place.id)} disabled={removeMutation.isPending}>
                        <Heart size={15} /> Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {removeMutation.isError && <p className="error-text" role="alert">Could not remove that saved place. Please try again.</p>}
      </div>
    </Shell>
  );
}

function SearchHistory() {
  const { data = [], error, isLoading } = useQuery({ queryKey: ['search-history'], queryFn: api.getHistory, retry: false });
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: api.deleteHistory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['search-history'] }),
  });

  return (
    <Shell>
      <div className="page-panel">
        <div className="panel-heading">
          <div>
            <p className="kicker">Recent searches</p>
            <h1>Your search history</h1>
          </div>
          <Clock3 size={18} />
        </div>

        {isLoading ? <p>Loading search history…</p> : error ? (
          <div className="empty-state"><h3>Sign in to view search history</h3><Link href="/login" className="primary-btn inline-link">Sign in</Link></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><h3>No recent searches</h3><p>Your searches will appear here when you sign in and discover places.</p><Link href="/" className="primary-btn inline-link">Discover places</Link></div>
        ) : (
          <div className="list-stack">
            {data.map((entry) => (
              <div key={entry._id || entry.id} className="history-item">
                <div>
                  <strong>{entry.location}</strong>
                  <small>{moods.find((item) => item.id === entry.mood)?.title || entry.mood} · {entry.category === 'all' ? 'all places' : entry.category}</small>
                </div>
                <span className="badge-tag">{entry.createdAt && Number.isFinite(new Date(entry.createdAt).getTime()) ? new Date(entry.createdAt).toLocaleDateString() : 'Recent search'}</span>
                <Link href={historySearchUrl(entry)} className="detail-link">Search again <ArrowRight size={15} /></Link>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Delete search for ${entry.location}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete the search for ${entry.location}?`)) deleteMutation.mutate(entry._id || entry.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {deleteMutation.isError && <p role="alert">Could not delete this search. Please try again.</p>}
      </div>
    </Shell>
  );
}

function historySearchUrl(entry) {
  const params = new URLSearchParams({
    location: entry.location || '',
    mood: entry.mood || 'relax',
    category: entry.category || 'all',
    radius: String(entry.radius || 10),
  });
  for (const key of ['city', 'state', 'country', 'countryCode', 'latitude', 'longitude']) {
    if (entry[key] != null && entry[key] !== '') params.set(key, String(entry[key]));
  }
  if (entry.location === 'Current GPS location') params.set('locationMode', 'gps');
  return `/places?${params.toString()}`;
}

function savedPlaceDetailsUrl(place) {
  const location = [place.city, place.state, place.country].filter(Boolean).join(', ') || place.address || 'Saved place';
  const params = new URLSearchParams({ location, mood: 'relax', category: 'all', radius: '10' });
  for (const key of ['city', 'state', 'country', 'latitude', 'longitude']) {
    if (place[key] != null && place[key] !== '') params.set(key, String(place[key]));
  }
  return `/place/${encodeURIComponent(place.id)}?${params.toString()}`;
}

function Profile() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: api.checkAuth, retry: false });

  return (
    <Shell>
      <div className="page-panel">
        <div className="panel-heading">
          <div>
            <p className="kicker">Profile</p>
            <h1>{user?.name || 'Your account'}</h1>
          </div>
        </div>

        <div className="profile-box">
          <ProfileAvatar user={user} large />
          <div>
            <strong>{user?.name || 'Guest'}</strong>
            <small>{user?.email || 'Complete your profile'}</small>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function AuthPage({ mode }) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
    onError: (err) => setError(err.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'register') {
      registerMutation.mutate(form);
      return;
    }

    loginMutation.mutate({ email: form.email, password: form.password });
  };

  return (
    <Shell>
      <div className="auth-shell">
        <div className="auth-card">
          <p className="kicker">{mode === 'login' ? 'Welcome back' : 'Create your account'}</p>
          <h1>{mode === 'login' ? 'Sign in' : 'Join for free'}</h1>
          <p className="auth-intro">{mode === 'login' ? 'Sign in to save places and pick up where you left off.' : 'Create an account to keep your favorite places close.'}</p>

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <label>
                <span>Name</span>
                <input autoComplete="name" maxLength={100} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </label>
            )}
            <label>
              <span>Email</span>
              <input type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              <span>Password</span>
              <span className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  maxLength={128}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 8 characters"
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === 'login' && <Link href="/forgot-password" className="auth-inline-link forgot-link">Forgot password?</Link>}
            {error && <p className="error-text" role="alert">{error}</p>}

            <button type="submit" className="primary-btn full-width" disabled={loginMutation.isPending || registerMutation.isPending}>
              {loginMutation.isPending || registerMutation.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'New to Mood Place?' : 'Already have an account?'}{' '}
            <Link className="auth-inline-link" href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const resetRequest = useMutation({
    mutationFn: api.requestPasswordReset,
    onSuccess: () => {
      setError('');
      setSubmitted(true);
    },
    onError: (requestError) => setError(requestError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError('');
    resetRequest.mutate(email.trim());
  };

  return (
    <Shell>
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="forgot-title">
          <p className="kicker">Account access</p>
          <h1 id="forgot-title">Reset your password</h1>
          <p className="auth-intro">Enter the email address associated with your account. We’ll send reset instructions if it matches an account.</p>
          {submitted ? (
            <div className="success-message" role="status">
              <p>If an account matches that email address, a password reset link has been sent.</p>
              <p>Check your inbox and spam folder. The link expires in 30 minutes.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <label>
                <span>Email</span>
                <input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              {error && <p className="error-text" role="alert">{error}</p>}
              <button type="submit" className="primary-btn full-width" disabled={resetRequest.isPending}>
                {resetRequest.isPending ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
          <Link href="/login" className="auth-inline-link auth-back-link"><ArrowLeft size={15} /> Back to Sign In</Link>
        </section>
      </div>
    </Shell>
  );
}

function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const resetMutation = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () => {
      window.history.replaceState({}, '', '/reset-password');
      navigate('/login');
    },
    onError: (requestError) => setError(requestError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    resetMutation.mutate({ token, password });
  };

  return (
    <Shell>
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="reset-title">
          <p className="kicker">Account access</p>
          <h1 id="reset-title">Choose a new password</h1>
          {!token ? (
            <div className="error-message" role="alert">
              <p>This reset link is missing or invalid.</p>
              <Link href="/forgot-password" className="auth-inline-link">Request another link</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <label>
                <span>New password</span>
                <span className="password-input-wrap">
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <label>
                <span>Confirm new password</span>
                <span className="password-input-wrap">
                  <input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your new password again" />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error && <p className="error-text" role="alert">{error}</p>}
              <button type="submit" className="primary-btn full-width" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? 'Updating…' : 'Reset Password'}
              </button>
            </form>
          )}
          <Link href="/login" className="auth-inline-link auth-back-link"><ArrowLeft size={15} /> Back to Sign In</Link>
        </section>
      </div>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <div className="empty-state">
        <h3>Page not found</h3>
        <Link href="/" className="primary-btn inline-link">Back home</Link>
      </div>
    </Shell>
  );
}
