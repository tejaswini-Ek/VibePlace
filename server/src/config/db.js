import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required. Configure a MongoDB connection string in server/.env.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string starting with mongodb:// or mongodb+srv://.');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string starting with mongodb:// or mongodb+srv://.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected.');
  return true;
}

export function isMongoReadyState() {
  return mongoose.connection.readyState === 1;
}

export async function closeDatabase() {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
}
