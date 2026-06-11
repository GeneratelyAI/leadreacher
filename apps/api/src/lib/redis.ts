import IORedis from "ioredis";
import { env } from "../config/env.js";

const UPSTASH_OPTIONS = {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
} as const;

export const redis = new IORedis(env.UPSTASH_REDIS_URL, {
  ...UPSTASH_OPTIONS,
  password: env.UPSTASH_REDIS_TOKEN,
});

export const redisSubscriber = new IORedis(env.UPSTASH_REDIS_URL, {
  ...UPSTASH_OPTIONS,
  password: env.UPSTASH_REDIS_TOKEN,
});
