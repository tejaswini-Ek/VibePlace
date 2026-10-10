# Mood-Based Place Recommender

A React/Vite and Express application that recommends nearby places based on mood and location. Location lookup uses Photon/OpenStreetMap, place discovery uses Overpass, weather uses Open-Meteo, and optional text recommendations use Groq.

## Project structure

- `client/` — React, Vite, Leaflet, and the responsive interface
- `server/` — Express API, OpenStreetMap/Open-Meteo/Groq integrations, and Mongoose models

## Project documentation

- [Complete Word project guide](docs/Mood-Based-Place-Finder-Complete-Project-Guide.docx) — consolidated report, REST API reference, resume entries, interview questions, and presentation scripts
- [Technical project report](docs/project-report.md) — architecture, data flows, features, limitations, security, setup, and evidence-based implementation notes
- [REST API reference](docs/api-documentation.md) — endpoints, request/response shapes, middleware, and errors
- [Resume and interview guide](docs/interview-preparation.md) — resume descriptions, project-specific interview questions, and presentation scripts

## Configure MongoDB

The API can use either a local MongoDB instance or MongoDB Atlas. Use the `MONGODB_URI` that matches your environment.

1. Copy `server/.env.example` to `server/.env` if `server/.env` does not already exist.
2. Set `MONGODB_URI` in `server/.env` to either a local MongoDB connection string such as:

   ```text
   mongodb://127.0.0.1:27017/mood-place
   ```

   or an Atlas SRV connection string such as:

   ```text
   mongodb+srv://<database-user>:<password>@<cluster-host>/mood_place_recommender?retryWrites=true&w=majority
   ```

   URL-encode special characters in the username or password. Keep `.env` private; do not paste it into source files or commit it.
3. Set `JWT_SECRET` to a random secret of at least 32 characters.

   Generate one locally in PowerShell with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

If MongoDB is temporarily unreachable, the Express API still starts in degraded mode so OSM place search can continue. Authentication, favorites, history, and other database-backed endpoints return HTTP 503 until MongoDB reconnects. `/health` reports `degraded`.

The app creates the `users`, `favourites`, and `searchhistories` collections when those features first write data. User email values are trimmed/lowercased and uniquely indexed; password hashes are bcrypt-protected and excluded from normal queries and API responses. Favourites keep a validated snapshot keyed by the stable OSM ID, with a unique `(userId, placeId)` index and a `(userId, createdAt)` index for the saved-place list. Search history is account-scoped, keeps only the submitted search criteria and result count, and has a `(userId, createdAt)` index; entries can be deleted individually.

Place results are fetched live from OpenStreetMap and held only in the existing bounded, 10-minute in-process cache. There is intentionally no MongoDB `places` collection: persisting every external result would add writes to normal searches and duplicate provider-owned data. Favorites remain usable through their OSM ID and embedded snapshot. Consequently, no MongoDB geospatial index is needed; distance sorting is performed against each provider result in the current search. User preferences and reviews are also not stored because those features are not implemented.

Mongoose declares the collection indexes from the schemas. For an existing Atlas database, confirm the unique `users.email` and `favourites(userId, placeId)` indexes can be created; pre-existing duplicates must be resolved before a unique index can build.

`GROQ_API_KEY` is optional. Without it, place search still works and the API clearly reports that AI recommendations are not configured. The key is read only by the backend.

### Password reset email

Password reset requires an SMTP account. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `RESET_EMAIL_FROM` in `server/.env`, and set `CLIENT_URL` to the frontend origin that should receive reset links. The reset link is single-use and expires after 30 minutes. Reset tokens are stored only as SHA-256 hashes. Until SMTP is configured, reset requests return HTTP 503 rather than claiming that an email was sent.

## Install and run

From the project root:

```powershell
npm install
npm run dev
```

The client is at <http://localhost:5173> and the API at <http://localhost:5000>. The Vite development server proxies `/api` and `/health` to the Express server.

To run the services separately, use two terminals:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix client run dev
```

Build the frontend with:

```powershell
npm run build
```

For a deployed frontend hosted on a different origin, set `VITE_API_BASE_URL` at frontend build time and set `CLIENT_URL` in the server environment to the allowed frontend origin.

## Included features

- Mood-first place discovery, neighborhood/colony/nagar location suggestions with selectable search radius, and optional browser GPS search
- Live OSM place lookup through the Express API, with server-side Photon/Overpass caching and Overpass fallback/retry
- Paginated place results (30 per page, maximum 50 per API page) so large searches are not truncated or rendered all at once
- Place cards and details use only metadata present in OSM; image, English description, rating, and price can remain unavailable
- Distance is calculated per search using the Haversine formula; opening status is calculated from OSM opening hours and the place timezone
- Client-side search, distance, type, open-status, and sort controls; rating/price filters appear only when result data provides them
- Open-Meteo current weather and forecast
- Optional Groq recommendations using supplied place/weather facts only
- Atlas-persisted accounts, favourites, and search history
- Rate-limited, email-delivered password reset with hashed expiring single-use tokens
- Place details, external directions, share, website, and phone links

OpenStreetMap coverage is incomplete. Missing ratings, prices, descriptions, addresses, or hours are omitted rather than fabricated; missing images use a neutral fallback. In particular, `stars` is not treated as a customer rating. Reviews are not included, and there is no separate `Place` collection: search results are live OSM data while MongoDB stores accounts, favorite snapshots, and search history.

## Database tests

Run the model/schema tests without connecting to MongoDB:

```powershell
npm --prefix server test
```

The suite includes an opt-in integration test. Set `MONGO_TEST_URI` to a disposable MongoDB database whose name contains `test` (for example, a dedicated local `mood-place-test` database) before running the same command to test connection, password hashing, unique indexes, and account-scoped history against MongoDB. The suite does not use `MONGODB_URI` or the app's `.env` for its integration database.

### MongoDB Atlas access

When using Atlas locally, allow the backend machine's current public IP under **Atlas → Security → Network Access → IP Access List**. Prefer the specific IP/network over `0.0.0.0/0`. The browser never connects to MongoDB; only the Express server uses `MONGODB_URI`. Keep `server/.env` private and use `server/.env.example` only as a placeholder template.

Photon and Overpass are public community services without an API key for this app. They have fair-use limits and can be temporarily unavailable; server caching, request cancellation, retries, and the alternate Overpass endpoint reduce repeated load but do not provide a guaranteed SLA. For a sustained high-volume deployment, use a provider or hosted instance whose terms and capacity meet the expected traffic.
The backend defaults are `PHOTON_URL=https://photon.komoot.io/api/` and `OVERPASS_URL=https://overpass-api.de/api/interpreter`; configure either in `server/.env` to use another compatible endpoint.
