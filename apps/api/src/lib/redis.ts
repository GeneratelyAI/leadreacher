import IORedis from "ioredis";
import { env } from "../config/env.js";

const isTlsRedis = env.REDIS_URL.startsWith("rediss://");
const redisPassword = env.REDIS_PASSWORD || undefined;

const REDIS_OPTIONS = {
  maxRetriesPerRequest: null,
  ...(isTlsRedis
    ? { tls: { rejectUnauthorized: false } }
    : {}),
} as const;

export const redis = new IORedis(env.REDIS_URL, {
  ...REDIS_OPTIONS,
  password: redisPassword,
});

export const redisSubscriber = new IORedis(env.REDIS_URL, {
  ...REDIS_OPTIONS,
  password: redisPassword,
});

export function createRedisSubscriber(): IORedis {
  return new IORedis(env.REDIS_URL, {
    ...REDIS_OPTIONS,
    password: redisPassword,
  });
}

async function closeRedisClient(client: IORedis): Promise<void> {
  if (client.status === "end") {
    return;
  }

  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export async function closeRedisConnections(): Promise<void> {
  await Promise.all([
    closeRedisClient(redis),
    closeRedisClient(redisSubscriber),
  ]);
}
