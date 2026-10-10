# VibePlace — Mood-Based Place Recommender

**Find your vibe. Discover your place!**

VibePlace is a mood-based place discovery application that helps users explore nearby places according to their mood and location. It uses OpenStreetMap data to discover places and integrates weather information to provide additional context for exploration.

The application supports place discovery, interactive maps, distance-based sorting, user accounts, favorites, search history, and optional AI-generated recommendations.

## Table of Contents

* [Project Overview](#project-overview)
* [Technology Stack](#technology-stack)
* [Features](#features)
* [Project Structure](#project-structure)
* [How Place Discovery Works](#how-place-discovery-works)
* [Installation and Setup](#installation-and-setup)
* [Environment Configuration](#environment-configuration)
* [MongoDB Configuration](#mongodb-configuration)
* [API and External Services](#api-and-external-services)
* [Testing](#testing)
* [Limitations](#limitations)
* [Project Documentation](#project-documentation)
* [Security Notes](#security-notes)

## Project Overview

VibePlace combines mood selection, location search, and place discovery in one application. Users can search for places in a city or locality, explore results on a map, and use available place information to decide where to go.

The application uses a React frontend and an Express backend. MongoDB stores account-related data, while place results are retrieved from external map data services.

## Technology Stack

| Technology                     | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| React.js                       | Frontend user interface                    |
| Vite                           | Frontend development server and build tool |
| JavaScript                     | Application programming language           |
| Node.js                        | Backend JavaScript runtime                 |
| Express.js                     | REST API and backend request handling      |
| MongoDB Atlas or local MongoDB | Persistent application data                |
| Mongoose                       | MongoDB object modeling                    |
| Leaflet                        | Interactive maps                           |
| Photon / OpenStreetMap         | Location lookup and geocoding              |
| Overpass API                   | OpenStreetMap place discovery              |
| Open-Meteo                     | Weather information and forecasts          |
| Groq API                       | Optional AI-generated text recommendations |
| JWT                            | Authentication tokens                      |
| bcrypt                         | Password hashing                           |

## Features

* **Mood-based discovery:** Search for places based on the selected mood and location.
* **Location search:** Search for cities and localities using the existing geocoding integration.
* **Interactive maps:** Explore place results using Leaflet.
* **Place discovery:** Retrieve place information from OpenStreetMap through the Overpass API.
* **Distance calculation:** Calculate distances using the Haversine formula.
* **Sorting and filtering:** Use available controls for search, distance, place type, opening status, and sorting.
* **Weather information:** Retrieve current weather and forecast data from Open-Meteo.
* **Optional AI recommendations:** Use Groq when the required API key is configured.
* **User accounts:** Register and authenticate users.
* **Favorites:** Save and retrieve favorite places.
* **Search history:** Keep account-specific records of previous searches.
* **Password reset:** Support email-based password reset when SMTP is configured.
* **Place details:** Access available details and external website, phone, sharing, and directions links.

## Project Structure

The main application directories are:

```text
VibePlace/
├── client/                 # React and Vite frontend
├── server/                 # Express backend
├── docs/
│   ├── Mood-Based-Place-Finder-Complete-Project-Guide.docx
│   ├── project-report.md
│   ├── api-documentation.md
│   └── interview-preparation.md
├── .gitignore
├── package.json
└── README.md
```

This is a high-level structure. Additional files and directories may exist in the actual project.

## How Place Discovery Works

1. The user selects a mood and enters a location.
2. The frontend sends the search request to the Express API.
3. The backend uses the configured geocoding and place-discovery services to locate and retrieve relevant places.
4. Place results are returned to the frontend and displayed in cards and on the map.
5. Distance calculations, filtering, and sorting help users explore the results.
6. Weather information can provide additional context, and AI-generated recommendations are available when Groq is configured.

The exact results depend on the search parameters, external service responses, and available OpenStreetMap data.

## Installation and Setup

### Prerequisites

Install the following before running the project:

* Node.js and npm
* A MongoDB instance, either local MongoDB or MongoDB Atlas
* Git, if you want to clone the repository

### 1. Clone the repository

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
cd VibePlace
```

Replace the repository URL and directory name with the values used for your GitHub repository.

### 2. Install dependencies

From the project root, run:

```bash
npm install
```

### 3. Configure environment variables

Create `server/.env` from `server/.env.example` if the file does not already exist.

Configure the required database connection and JWT secret before using database-backed features.

See [Environment Configuration](#environment-configuration) below.

### 4. Start the application

From the project root:

```bash
npm run dev
```

According to the current project configuration, the frontend is available at:

* Frontend: `http://localhost:5173`
* Backend API: `http://localhost:5000`

The Vite development server proxies `/api` and `/health` requests to the Express server.

Alternatively, start the services in separate terminals.

**Terminal 1 — Backend**

```bash
npm --prefix server run dev
```

**Terminal 2 — Frontend**

```bash
npm --prefix client run dev
```

### 5. Build the frontend

From the project root:

```bash
npm run build
```

This command should be run according to the scripts configured in the root `package.json`.

## Environment Configuration

The backend reads configuration from `server/.env`. Use `server/.env.example` as the template and keep the actual environment file private.

| Variable           | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `PORT`             | Express server port                            |
| `NODE_ENV`         | Application environment                        |
| `MONGODB_URI`      | MongoDB connection string                      |
| `JWT_SECRET`       | Secret used for JWT signing and verification   |
| `GROQ_API_KEY`     | Optional Groq API key                          |
| `SMTP_HOST`        | SMTP server hostname for password-reset emails |
| `SMTP_PORT`        | SMTP server port                               |
| `SMTP_SECURE`      | SMTP security configuration                    |
| `SMTP_USER`        | SMTP authentication username                   |
| `SMTP_PASSWORD`    | SMTP authentication password                   |
| `RESET_EMAIL_FROM` | Sender address for reset emails                |
| `CLIENT_URL`       | Frontend origin used in password-reset links   |
| `PHOTON_URL`       | Configurable Photon endpoint                   |
| `OVERPASS_URL`     | Configurable Overpass endpoint                 |

The frontend may also use `VITE_API_BASE_URL` when deployed separately from the backend. Configure it according to the deployment environment.

Set each variable according to the existing environment template and backend implementation. Do not commit actual credentials or secret values.

## MongoDB Configuration

VibePlace supports either local MongoDB or MongoDB Atlas.

### Local MongoDB

An example connection string is:

```text
mongodb://127.0.0.1:27017/mood-place
```

### MongoDB Atlas

An example SRV connection string is:

```text
mongodb+srv://<database-user>:<password>@<cluster-host>/mood_place_recommender?retryWrites=true&w=majority
```

Replace the placeholders with your actual Atlas credentials and cluster hostname. URL-encode special characters in the username or password when required.

For local development with Atlas:

1. Create a database user in Atlas.
2. Add your development machine's public IP address under **Security → Network Access → IP Access List**.
3. Put the Atlas connection string in `server/.env`.
4. Start the backend and check its logs to confirm the connection.

Prefer restricting network access to the necessary IP addresses instead of allowing access from every IP address.

### Database design

According to the supplied project documentation, MongoDB stores account-related data rather than every live place-search result.

The documented collections are:

* `users` — user account information.
* `favourites` — saved places associated with users.
* `searchhistories` — account-specific search records.

Place results are fetched from OpenStreetMap and cached in process for a limited period rather than being persisted in a separate `places` collection.

The documented schema behavior includes password hashing, unique user email indexing, unique favorite identification per user and place, and indexes for retrieving favorites and search history.

Mongoose schemas declare the relevant indexes. Existing databases should be checked for duplicate values before unique indexes are created successfully.

### Database availability

The supplied project documentation describes a degraded startup mode when MongoDB is temporarily unavailable. In that state, external place discovery may continue, while database-dependent features return HTTP 503 until the database reconnects.

Check the `/health` endpoint and backend logs to determine the application's current health.

## API and External Services

| Service          | Role                                    |
| ---------------- | --------------------------------------- |
| Express REST API | Handles frontend requests               |
| Photon           | Location lookup and geocoding           |
| Overpass API     | Retrieves place data from OpenStreetMap |
| Open-Meteo       | Provides weather information            |
| Groq             | Optional text recommendations           |
| MongoDB          | Stores persistent user-related data     |

The documented default endpoints are:

* Photon: `https://photon.komoot.io/api/`
* Overpass: `https://overpass-api.de/api/interpreter`

Both can be configured through the corresponding backend environment variables.

The application documentation describes server-side caching, retries, and an alternate Overpass endpoint to reduce repeated requests and help handle temporary service failures.

For endpoint paths, request parameters, response formats, middleware, and error codes, see the [REST API Reference](docs/api-documentation.md).

## Testing

Run the backend test suite from the project root:

```bash
npm --prefix server test
```

The supplied project documentation describes an optional MongoDB integration test that uses `MONGO_TEST_URI`.

Configure this variable with a disposable test database whose name contains `test`, for example a dedicated `mood-place-test` database. The integration test is intended to check database connection behavior, password hashing, indexes, and account-scoped history.

The test suite is documented as using `MONGO_TEST_URI` rather than the application's `MONGODB_URI`.

Run the tests and review their actual output before reporting whether they pass. Do not use a production database for integration tests.

## Limitations

* **OpenStreetMap data:** Coverage and completeness vary by location. Some places may lack descriptions, images, ratings, prices, addresses, or opening hours.
* **External services:** Photon, Overpass, Open-Meteo, and Groq depend on their respective service availability and applicable usage limits.
* **Place ratings and prices:** These are not guaranteed to be available in OpenStreetMap data.
* **Images and descriptions:** Missing information may result in fallback UI instead of a complete place card.
* **Distance:** Haversine calculates straight-line geographic distance, not driving or walking distance.
* **AI recommendations:** Groq-based recommendations require the relevant backend configuration.
* **Database-backed features:** Authentication, favorites, and history depend on MongoDB connectivity.
* **Password reset:** Email delivery requires working SMTP configuration.

The application should display only information supported by the available data rather than inventing missing place details.

## Project Documentation

Additional documentation is available in the `docs/` directory:

* [Complete Project Guide](docs/Mood-Based-Place-Finder-Complete-Project-Guide.docx) — consolidated project report, API reference, resume material, interview questions, and presentation scripts.
* [Technical Project Report](docs/project-report.md) — architecture, data flows, features, limitations, security, setup, and implementation notes.
* [REST API Reference](docs/api-documentation.md) — endpoints, request and response formats, middleware, and errors.
* [Resume and Interview Guide](docs/interview-preparation.md) — project descriptions, interview questions, and presentation scripts.

These links assume that the files exist at the specified paths in the repository.

## Security Notes

* Never commit `.env` files or real API keys, database credentials, SMTP passwords, or JWT secrets.
* Use a strong, randomly generated JWT secret.
* Keep database credentials on the backend; the browser should not connect directly to MongoDB.
* Configure Atlas network access with the minimum required permissions.
* Use a dedicated test database for integration testing.
* If a credential is accidentally committed, rotate it immediately. Removing it from the latest commit alone does not remove it from Git history.


