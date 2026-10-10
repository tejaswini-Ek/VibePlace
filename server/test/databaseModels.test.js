import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { closeDatabase, connectDatabase } from '../src/config/db.js';
import { requestPasswordReset, resetPassword } from '../src/controllers/authController.js';
import { signToken } from '../src/middleware/auth.js';
import { Favourite } from '../src/models/Favourite.js';
import { SearchHistory } from '../src/models/SearchHistory.js';
import { User } from '../src/models/User.js';
import { haversineDistanceKm } from '../src/utils/placeData.js';
import { locationFields, prioritizeLocalities } from '../src/utils/geocoding.js';

function makePlace(overrides = {}) {
  return {
    id: 'node-123',
    osmType: 'node',
    osmId: '123',
    name: 'Coffee Place',
    category: 'cafe',
    latitude: 18.52,
    longitude: 73.85,
    source: 'OpenStreetMap',
    ...overrides,
  };
}

test('user model normalizes email, validates input, hashes passwords, and omits hashes from JSON', async () => {
  const user = new User({
    name: ' Test User ',
    email: ' USER@Example.COM ',
    passwordHash: 'password123',
    profileImage: 'https://example.com/profile.png',
    preferredLocation: 'Pune',
  });

  assert.equal(user.email, 'user@example.com');
  assert.equal(user.name, 'Test User');
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.authVersion, 0);

  await new Promise((resolve, reject) => {
    User.schema.s.hooks.execPre('save', user, (error) => (error ? reject(error) : resolve()));
  });
  assert.notEqual(user.passwordHash, 'password123');
  assert.equal(await bcrypt.compare('password123', user.passwordHash), true);
  assert.equal(Object.hasOwn(user.toJSON(), 'passwordHash'), false);
  assert.equal(User.schema.path('passwordHash').options.select, false);
  assert.equal(User.schema.path('resetTokenHash').options.select, false);
  assert.equal(User.schema.path('resetTokenExpiresAt').options.select, false);
  const withResetToken = new User({
    name: 'Reset Token User',
    email: 'reset@example.com',
    passwordHash: 'password123',
    resetTokenHash: 'sensitive-hash',
    resetTokenExpiresAt: new Date(),
  });
  assert.equal(Object.hasOwn(withResetToken.toJSON(), 'resetTokenHash'), false);
  assert.equal(Object.hasOwn(withResetToken.toJSON(), 'resetTokenExpiresAt'), false);

  const invalidUser = new User({
    name: 'No Email Validation',
    email: 'not-an-email',
    passwordHash: 'password123',
  });
  assert.ok(invalidUser.validateSync()?.errors.email);
});

test('favourite snapshots validate provider identity and coordinates and declare ownership indexes', async () => {
  const validFavourite = new Favourite({
    userId: new mongoose.Types.ObjectId(),
    placeId: 'node-123',
    place: makePlace(),
  });
  assert.equal(await validFavourite.validate(), undefined);

  const invalidFavourite = new Favourite({
    userId: new mongoose.Types.ObjectId(),
    placeId: 'not-an-osm-id',
    place: makePlace({ latitude: 91 }),
  });
  await assert.rejects(invalidFavourite.validate(), mongoose.Error.ValidationError);

  const indexes = Favourite.schema.indexes();
  assert.ok(indexes.some(([keys, options]) =>
    keys.userId === 1 && keys.placeId === 1 && options.unique === true,
  ));
  assert.ok(indexes.some(([keys]) => keys.userId === 1 && keys.createdAt === -1));
});

test('search history validates paired coordinates, radius, and result counts', async () => {
  const history = new SearchHistory({
    userId: new mongoose.Types.ObjectId(),
    location: 'Pune, India',
    city: 'Pune',
    mood: 'relax',
    category: 'cafe',
    latitude: 18.52,
    longitude: 73.85,
    radius: 5,
    resultsCount: 8,
  });
  assert.equal(await history.validate(), undefined);

  const unpairedCoordinates = new SearchHistory({
    userId: new mongoose.Types.ObjectId(),
    location: 'Pune, India',
    latitude: 18.52,
  });
  await assert.rejects(unpairedCoordinates.validate(), mongoose.Error.ValidationError);

  const invalidResultCount = new SearchHistory({
    userId: new mongoose.Types.ObjectId(),
    location: 'Pune, India',
    resultsCount: 1.5,
  });
  await assert.rejects(invalidResultCount.validate(), mongoose.Error.ValidationError);
  assert.ok(SearchHistory.schema.indexes().some(([keys]) => keys.userId === 1 && keys.createdAt === -1));
});

test('distance calculation remains available without a persistent Place collection', () => {
  const distance = haversineDistanceKm(0, 0, 0, 1);
  assert.ok(Math.abs(distance - 111.195) < 0.01);
  assert.equal(mongoose.models.Place, undefined);
});

test('locality geocoding prefers a requested colony over its parent city', () => {
  const pune = {
    properties: { osm_type: 'relation', osm_id: 1, name: 'Pune', type: 'city', city: 'Pune', state: 'Maharashtra' },
    geometry: { coordinates: [73.8567, 18.5204] },
  };
  const kothrud = {
    properties: { osm_type: 'way', osm_id: 2, name: 'Kothrud', type: 'district', city: 'Pune', state: 'Maharashtra' },
    geometry: { coordinates: [73.8077, 18.5074] },
  };

  assert.equal(prioritizeLocalities([pune, kothrud], 'Kothrud, Pune, Maharashtra')[0], kothrud);
  assert.equal(prioritizeLocalities([kothrud, pune], 'Pune, Maharashtra')[0], pune);
  assert.deepEqual(locationFields(kothrud.properties), {
    city: 'Pune',
    locality: 'Kothrud',
    state: 'Maharashtra',
    country: null,
    countryCode: null,
  });
});

test('password reset endpoints validate malformed requests without revealing account state', async () => {
  const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  const invalidEmailResponse = makeResponse();
  await requestPasswordReset({ body: { email: 'invalid' } }, invalidEmailResponse, (error) => { throw error; });
  assert.equal(invalidEmailResponse.statusCode, 400);

  const invalidTokenResponse = makeResponse();
  await resetPassword({ body: { token: 'invalid', password: 'password123' } }, invalidTokenResponse, (error) => { throw error; });
  assert.equal(invalidTokenResponse.statusCode, 400);
  assert.match(invalidTokenResponse.body.error, /invalid or expired/i);

  const shortPasswordResponse = makeResponse();
  await resetPassword({ body: { token: randomBytes(32).toString('base64url'), password: 'short' } }, shortPasswordResponse, (error) => { throw error; });
  assert.equal(shortPasswordResponse.statusCode, 400);

  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'RESET_EMAIL_FROM', 'CLIENT_URL'];
  const previousSettings = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of smtpKeys) process.env[key] = '';
    const smtpUnavailableResponse = makeResponse();
    await requestPasswordReset({ body: { email: 'person@example.com' } }, smtpUnavailableResponse, (error) => { throw error; });
    assert.equal(smtpUnavailableResponse.statusCode, 503);
    assert.match(smtpUnavailableResponse.body.error, /not configured/i);
  } finally {
    for (const key of smtpKeys) {
      if (previousSettings[key] === undefined) delete process.env[key];
      else process.env[key] = previousSettings[key];
    }
  }
});

const mongoTestUri = process.env.MONGO_TEST_URI?.trim();
test('MongoDB integration: connection, unique users/favourites, hashing, and owner-scoped history', {
  skip: !mongoTestUri,
}, async () => {
  const databaseName = new URL(mongoTestUri).pathname.slice(1);
  assert.match(databaseName, /(^|[-_])test($|[-_])/i, 'MONGO_TEST_URI must target a dedicated test database.');

  const previousUri = process.env.MONGODB_URI;
  const previousJwtSecret = process.env.JWT_SECRET;
  const runId = randomUUID();
  process.env.MONGODB_URI = mongoTestUri;
  process.env.JWT_SECRET = `integration-${runId}-secret`;
  let firstUser;
  let secondUser;
  let server;

  try {
    await connectDatabase();
    assert.equal(mongoose.connection.readyState, 1);
    await Promise.all([User.init(), Favourite.init(), SearchHistory.init()]);

    firstUser = await User.create({
      name: 'Integration User',
      email: `integration-${runId}@example.test`,
      passwordHash: 'password123',
    });
    secondUser = await User.create({
      name: 'Other User',
      email: `other-${runId}@example.test`,
      passwordHash: 'password123',
    });

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const firstToken = signToken(firstUser);
    const secondToken = signToken(secondUser);
    const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const registerResponse = await request('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({
        name: 'API Registration',
        email: `api-${runId}@example.test`.toUpperCase(),
        password: 'password123',
      }),
    });
    assert.equal(registerResponse.status, 201);
    const registeredUser = await registerResponse.json();
    assert.equal(registeredUser.user.email, `api-${runId}@example.test`);
    assert.equal(Object.hasOwn(registeredUser.user, 'passwordHash'), false);
    const duplicateRegistration = await request('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Registration',
        email: `API-${runId}@example.test`,
        password: 'password123',
      }),
    });
    assert.equal(duplicateRegistration.status, 409);

    const loginResponse = await request('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({
        email: `API-${runId}@example.test`,
        password: 'password123',
      }),
    });
    assert.equal(loginResponse.status, 200);
    assert.equal(Object.hasOwn(await loginResponse.json(), 'passwordHash'), false);
    const currentUserResponse = await request('/api/auth/me', firstToken);
    assert.equal(currentUserResponse.status, 200);
    assert.equal(Object.hasOwn(await currentUserResponse.json(), 'passwordHash'), false);

    const authenticatedUser = await User.findOne({ _id: firstUser._id }).select('+passwordHash');
    assert.equal(await authenticatedUser.comparePassword('password123'), true);
    assert.equal(Object.hasOwn((await User.findById(firstUser._id)).toJSON(), 'passwordHash'), false);

    const invalidResetRequest = await request('/api/auth/forgot-password', null, {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    assert.equal(invalidResetRequest.status, 400);
    const missingEmailSettings = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'RESET_EMAIL_FROM'];
    const previousEmailSettings = Object.fromEntries(missingEmailSettings.map((key) => [key, process.env[key]]));
    for (const key of missingEmailSettings) process.env[key] = '';
    const unavailableResetEmail = await request('/api/auth/forgot-password', null, {
      method: 'POST',
      body: JSON.stringify({ email: firstUser.email }),
    });
    assert.equal(unavailableResetEmail.status, 503);
    for (const key of missingEmailSettings) {
      if (previousEmailSettings[key] === undefined) delete process.env[key];
      else process.env[key] = previousEmailSettings[key];
    }

    const resetToken = randomBytes(32).toString('base64url');
    await User.updateOne(
      { _id: firstUser._id },
      {
        $set: {
          resetTokenHash: createHash('sha256').update(resetToken).digest('hex'),
          resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      },
    );
    const resetResponse = await request('/api/auth/reset-password', null, {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: 'new-password-123' }),
    });
    assert.equal(resetResponse.status, 200);
    const resetUser = await User.findById(firstUser._id).select('+passwordHash +resetTokenHash +resetTokenExpiresAt');
    assert.equal(await resetUser.comparePassword('new-password-123'), true);
    assert.equal(resetUser.authVersion, 1);
    assert.equal(resetUser.resetTokenHash, undefined);
    assert.equal(resetUser.resetTokenExpiresAt, undefined);
    assert.equal((await request('/api/auth/me', firstToken)).status, 401);
    const updatedPasswordLogin = await request('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email: firstUser.email, password: 'new-password-123' }),
    });
    assert.equal(updatedPasswordLogin.status, 200);
    const replayedReset = await request('/api/auth/reset-password', null, {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: 'another-password-123' }),
    });
    assert.equal(replayedReset.status, 400);
    const expiredToken = randomBytes(32).toString('base64url');
    await User.updateOne(
      { _id: firstUser._id },
      {
        $set: {
          resetTokenHash: createHash('sha256').update(expiredToken).digest('hex'),
          resetTokenExpiresAt: new Date(Date.now() - 1000),
        },
      },
    );
    const expiredReset = await request('/api/auth/reset-password', null, {
      method: 'POST',
      body: JSON.stringify({ token: expiredToken, password: 'another-password-123' }),
    });
    assert.equal(expiredReset.status, 400);
    await assert.rejects(
      User.create({
        name: 'Duplicate Email',
        email: firstUser.email.toUpperCase(),
        passwordHash: 'password123',
      }),
      (error) => error.code === 11000,
    );

    const favoritePayload = { place: makePlace() };
    const firstFavoriteResponse = await request('/api/favourites', firstToken, {
      method: 'POST',
      body: JSON.stringify(favoritePayload),
    });
    assert.equal(firstFavoriteResponse.status, 201);
    const invalidFavoriteResponse = await request('/api/favourites', firstToken, {
      method: 'POST',
      body: JSON.stringify({ place: makePlace({ id: 'bad-id' }) }),
    });
    assert.equal(invalidFavoriteResponse.status, 400);
    const duplicateFavoriteResponse = await request('/api/favourites', firstToken, {
      method: 'POST',
      body: JSON.stringify(favoritePayload),
    });
    assert.ok([200, 201].includes(duplicateFavoriteResponse.status));
    assert.equal(await Favourite.countDocuments({ userId: firstUser._id, placeId: 'node-123' }), 1);
    const otherUserFavouritesResponse = await request('/api/favourites', secondToken);
    assert.equal((await otherUserFavouritesResponse.json()).length, 0);
    const ownFavouritesResponse = await request('/api/favourites', firstToken);
    const ownFavourites = await ownFavouritesResponse.json();
    assert.equal(ownFavourites.length, 1);
    assert.equal(ownFavourites[0].place.latitude, 18.52);
    assert.equal(ownFavourites[0].place.longitude, 73.85);

    const crossOwnerFavoriteDelete = await request('/api/favourites/node-123', secondToken, { method: 'DELETE' });
    assert.equal(crossOwnerFavoriteDelete.status, 404);
    const ownFavoriteDelete = await request('/api/favourites/node-123', firstToken, { method: 'DELETE' });
    assert.equal(ownFavoriteDelete.status, 200);

    const addHistoryResponse = await request('/api/search-history', firstToken, {
      method: 'POST',
      body: JSON.stringify({
        location: 'Pune, India',
        city: 'Pune',
        mood: 'relax',
        category: 'cafe',
        radius: 5,
        resultsCount: 2,
        latitude: 18.52,
        longitude: 73.85,
      }),
    });
    assert.equal(addHistoryResponse.status, 201);
    const ownedHistory = await addHistoryResponse.json();
    assert.equal(ownedHistory.radius, 5);
    assert.equal(ownedHistory.resultsCount, 2);
    assert.equal(ownedHistory.latitude, 18.52);
    assert.equal(ownedHistory.longitude, 73.85);
    const invalidHistoryResponse = await request('/api/search-history', firstToken, {
      method: 'POST',
      body: JSON.stringify({ location: 'Pune', radius: 21 }),
    });
    assert.equal(invalidHistoryResponse.status, 400);
    const otherHistory = await SearchHistory.create({
      userId: secondUser._id,
      location: 'Mumbai, India',
    });

    const ownHistoryResponse = await request('/api/search-history', firstToken);
    assert.deepEqual(
      (await ownHistoryResponse.json()).map(({ _id }) => String(_id)),
      [String(ownedHistory._id)],
    );
    const crossOwnerHistoryDelete = await request(`/api/search-history/${otherHistory._id}`, firstToken, {
      method: 'DELETE',
    });
    assert.equal(crossOwnerHistoryDelete.status, 404);
    assert.ok(await SearchHistory.findById(otherHistory._id));
    const ownHistoryDelete = await request(`/api/search-history/${ownedHistory._id}`, firstToken, {
      method: 'DELETE',
    });
    assert.equal(ownHistoryDelete.status, 200);

    const unauthenticatedHistoryResponse = await request('/api/search-history', null);
    assert.equal(unauthenticatedHistoryResponse.status, 401);
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        User.deleteMany({ email: { $regex: runId } }),
        Favourite.deleteMany({ userId: { $in: [firstUser?._id, secondUser?._id].filter(Boolean) } }),
        SearchHistory.deleteMany({ userId: { $in: [firstUser?._id, secondUser?._id].filter(Boolean) } }),
      ]);
    }
    await closeDatabase();
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});
