import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/authRoutes.js';
import { placeRoutes } from './routes/placeRoutes.js';
import { recommendationRoutes } from './routes/recommendationRoutes.js';
import { favouriteRoutes } from './routes/favouriteRoutes.js';
import { historyRoutes } from './routes/searchHistoryRoutes.js';
import { locationRoutes } from './routes/locationRoutes.js';
import { weatherRoutes } from './routes/weatherRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { isMongoReadyState } from './config/db.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
app.disable('x-powered-by');

function requireMongo(req, res, next) {
  if (!isMongoReadyState()) {
    return res.status(503).json({ error: 'Database features are temporarily unavailable.' });
  }
  return next();
}

app.use(
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: isMongoReadyState() ? 'ok' : 'degraded' });
});

app.use('/api/auth', requireMongo, authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/favourites', requireMongo, favouriteRoutes);
app.use('/api/search-history', requireMongo, historyRoutes);
app.use('/api/users', requireMongo, requireAuth, userRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.use((err, req, res, next) => {
  const isDuplicate = err.code === 11000;
  const isValidationError = err.name === 'ValidationError';
  const status =
    err.statusCode ||
    (isDuplicate ? 409 : isValidationError ? 400 : null) ||
    (Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500);
  const normalizedCode =
    err.code && !isDuplicate
      ? err.code
      : isDuplicate
        ? 'DUPLICATE_RESOURCE'
        : isValidationError
          ? 'INVALID_REQUEST'
          : status >= 500
            ? 'PLACE_SERVICE_UNAVAILABLE'
            : 'INVALID_REQUEST';

  if (err.type === 'entity.parse.failed') {
    console.warn('Rejected request with malformed JSON:', {
      method: req.method,
      path: req.path,
      contentType: req.get('content-type') || null,
      contentLength: req.get('content-length') || null,
      position: Number.isInteger(err.position) ? err.position : null,
    });
  } else if (status >= 500) {
    const details = {
      status,
      name: err.name || 'Error',
      method: req.method,
      path: req.path,
    };
    if (err.stage) details.stage = err.stage;
    if (err.cause) {
      details.cause = { name: err.cause.name || 'Error' };
      if (err.cause.code) details.cause.code = err.cause.code;
      if (err.cause.provider) details.cause.provider = err.cause.provider;
      if (Number.isInteger(err.cause.statusCode)) details.cause.statusCode = err.cause.statusCode;
      if (err.cause.cause?.code) details.cause.causeCode = err.cause.cause.code;
    }
    console.error('Unhandled error:', details);
  }

  const message = err.type === 'entity.parse.failed'
    ? 'Invalid JSON request body.'
    : isDuplicate
      ? 'A record with these details already exists.'
      : isValidationError
        ? 'Request data failed validation.'
    : status >= 500
      ? 'Unable to retrieve places right now.'
      : err.message || 'Invalid request.';

  res.status(status).json({
    success: false,
    error: {
      code: normalizedCode,
      message,
    },
  });
});

export default app;
