import { createClient, type RedisClientType } from "redis";
import { logger } from "../lib/logger";

type CacheEntry = { expiresAt: number; value: string };

const memory = new Map<string, CacheEntry>();
let redisClient: RedisClientType | null = null;

export async function initializeCache(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("REDIS_URL is not configured; using an explicitly limited process-local cache");
    return;
  }

  const client = createClient({ url });
  client.on("error", (err) => logger.error({ err }, "Redis client error"));
  try {
    await client.connect();
    redisClient = client;
    logger.info("Redis cache connected");
  } catch (err) {
    logger.error({ err }, "Redis connection failed; using process-local cache");
    try {
      client.disconnect();
    } catch {
      // The client may not have opened a socket.
    }
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redisClient?.isOpen) {
    try {
      const value = await redisClient.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (err) {
      logger.error({ err }, "Redis read failed");
    }
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const encoded = JSON.stringify(value);
  if (redisClient?.isOpen) {
    try {
      await redisClient.set(key, encoded, { EX: ttlSeconds });
      return;
    } catch (err) {
      logger.error({ err }, "Redis write failed");
    }
  }

  memory.set(key, { value: encoded, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memory.size > 300) {
    const now = Date.now();
    for (const [entryKey, entry] of memory) {
      if (entry.expiresAt <= now) memory.delete(entryKey);
    }
    while (memory.size > 300) {
      const firstKey = memory.keys().next().value as string | undefined;
      if (!firstKey) break;
      memory.delete(firstKey);
    }
  }
}
