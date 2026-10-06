import mongoose from "mongoose";
import { logger } from "../lib/logger";

let connectAttempt: Promise<void> | null = null;

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn("MONGODB_URI is not configured; database-backed routes will return 503");
    return;
  }

  if (isMongoReady()) return;
  if (connectAttempt) return connectAttempt;

  connectAttempt = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(() => {
      logger.info("MongoDB connection established");
    })
    .catch((err: unknown) => {
      logger.error({ err }, "MongoDB connection failed");
    })
    .finally(() => {
      connectAttempt = null;
    });

  await connectAttempt;
}

export function requireMongo(): boolean {
  return isMongoReady();
}
