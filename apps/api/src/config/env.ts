import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), ".env") });

const optionalBoolean = z
  .preprocess((value) => {
    if (typeof value === "boolean" || value === undefined) {
      return value;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "") {
      return undefined;
    }

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }

    return value;
  }, z.boolean().optional());

const DEFAULT_VEO_PARALLEL_VARIANTS =
  process.env.NODE_ENV === "production" ? 3 : 1;

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const enabledByDefaultBooleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().url().optional(),
);

const redisConnectionUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
    "Must use a redis:// or rediss:// connection URL",
  );

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  RUNTIME_ROLE: z.enum(["api", "worker"]).default("api"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  UNIPILE_DSN: z.string().min(1),
  UNIPILE_API_KEY: z.string().min(1),
  UNIPILE_WEBHOOK_SECRET: z.string().min(1),
  // Apify is optional company enrichment. LinkedIn discovery always uses Unipile.
  APIFY_API_KEY: z.string().optional().default(""),
  UPSTASH_REDIS_URL: redisConnectionUrl,
  UPSTASH_REDIS_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  GOOGLE_AI_API_KEY: z.string().optional().default(""),
  GOOGLE_TTS_API_KEY: z.string().optional().default(""),
  VIDEO_GENERATION_PROVIDER: z.enum(["veo", "omni"]).default("veo"),
  PERSONALIZED_VIDEO_TTS_VOICE: z.string().min(1).default("Kore"),
  SENTRY_DSN: z.string().optional().default(""),
  SENTRY_ENVIRONMENT: z.string().min(1).default(process.env.NODE_ENV ?? "development"),
  BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL: optionalUrl,
  BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL: optionalUrl,
  BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL: optionalUrl,
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET_NAME: z.string().optional().default(""),
  R2_PUBLIC_URL: z.string().optional().default(""),
  R2_PREFLIGHT_VIDEO_URL: optionalUrl,
  VIDEO_MOCK_MODE: booleanString,
  STRIPE_MOCK_MODE: enabledByDefaultBooleanString,
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_PERSONALIZED_OUTREACH: z.string().optional().default(""),
  STRIPE_PRICE_AI_VIDEO_AD: z.string().optional().default(""),
  STRIPE_PRICE_UPLOADED_VIDEO: z.string().optional().default(""),
  STRIPE_PRICE_VIDEO_ADDON: z.string().optional().default(""),
  APP_URL: z.string().url().default("http://localhost:3000"),
  UNIPILE_WEBHOOK_URL: z.string().url().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  FIRECRAWL_API_KEY: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : undefined,
      z.string().min(1).optional(),
    ),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:3000")
    .superRefine((value, ctx) => {
      const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
      if (origins.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "CORS_ORIGIN must contain at least one origin",
        });
      }
    }),
  ENABLE_CAMPAIGN_WORKER: optionalBoolean,
  ENABLE_RECONCILE_WORKER: optionalBoolean,
  ENABLE_VIDEO_WORKER: optionalBoolean,
  ENABLE_ANALYTICS_INSIGHTS_WORKER: optionalBoolean,
  ENABLE_LIFECYCLE_WORKER: optionalBoolean,
  PAUSED_WORKER_FAMILIES: z.string().default(""),
  ENABLE_API_DOCS: optionalBoolean,
  BULLMQ_IDLE_DRAIN_DELAY_SECONDS: z.coerce
    .number()
    .int()
    .min(5)
    .max(60)
    .default(60),
  VEO_PARALLEL_VARIANTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .default(DEFAULT_VEO_PARALLEL_VARIANTS),
  SUPPORT_EMAIL: z.string().email().default("support@leadreacher.com"),
  RESEND_API_KEY: z.string().optional().default(""),
  PRODUCT_EMAIL_FROM: z
    .string()
    .min(1)
    .default("LeadReacher <notifications@leadreacher.com>"),
  TERMS_VERSION: z.string().min(1).default("2026-08-04"),
  PRIVACY_VERSION: z.string().min(1).default("2026-08-04"),
  LEGAL_ACCEPTANCE_REQUIRED: booleanString,
}).superRefine((value, ctx) => {
  if (value.STRIPE_MOCK_MODE) {
    return;
  }

  for (const key of [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_PERSONALIZED_OUTREACH",
    "STRIPE_PRICE_AI_VIDEO_AD",
    "STRIPE_PRICE_UPLOADED_VIDEO",
    "STRIPE_PRICE_VIDEO_ADDON",
  ] as const) {
    if (!value[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required when STRIPE_MOCK_MODE=false`,
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getProductionPublicConfigurationErrors(value: {
  APP_URL?: string;
  CORS_ORIGIN?: string;
}): string[] {
  const appUrl = value.APP_URL?.trim();
  const corsOrigin = value.CORS_ORIGIN?.trim();
  const errors: string[] = [];

  if (!appUrl) errors.push("APP_URL is required");
  if (!corsOrigin) errors.push("CORS_ORIGIN is required");
  if (appUrl && isLoopbackUrl(appUrl)) {
    errors.push("APP_URL must not point to localhost");
  }
  if (corsOrigin) {
    const origins = corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
    if (origins.some(isLoopbackUrl)) {
      errors.push("CORS_ORIGIN must not contain localhost");
    }
  }

  return errors;
}

export function requiresProductionPublicConfigurationValidation(value: {
  nodeEnv?: string;
  runtimeRole?: string;
}): boolean {
  return value.nodeEnv === "production" && value.runtimeRole !== "worker";
}

if (
  requiresProductionPublicConfigurationValidation({
    nodeEnv: process.env.NODE_ENV,
    runtimeRole: env.RUNTIME_ROLE,
  })
) {
  const errors = getProductionPublicConfigurationErrors(process.env);
  if (errors.length > 0) {
    throw new Error(`Invalid production environment variables: ${errors.join(", ")}`);
  }
}

if (env.VIDEO_MOCK_MODE && process.env.NODE_ENV === "production") {
  throw new Error("VIDEO_MOCK_MODE cannot be enabled in production");
}

if (env.STRIPE_MOCK_MODE && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_MOCK_MODE cannot be enabled in production");
}

export type Env = z.infer<typeof envSchema>;

const REQUIRED_PRODUCTION_WORKER_FLAGS = [
  "ENABLE_CAMPAIGN_WORKER",
  "ENABLE_RECONCILE_WORKER",
  "ENABLE_VIDEO_WORKER",
  "ENABLE_ANALYTICS_INSIGHTS_WORKER",
  "ENABLE_LIFECYCLE_WORKER",
] as const;

const WORKER_FAMILY_NAMES = [
  "campaign",
  "reconcile",
  "video",
  "analytics",
  "lifecycle",
] as const;

export type WorkerFamilyName = (typeof WORKER_FAMILY_NAMES)[number];

type ProductionWorkerConfiguration = Pick<
  Env,
  | "ENABLE_CAMPAIGN_WORKER"
  | "ENABLE_RECONCILE_WORKER"
  | "ENABLE_VIDEO_WORKER"
  | "ENABLE_ANALYTICS_INSIGHTS_WORKER"
  | "ENABLE_LIFECYCLE_WORKER"
  | "SENTRY_DSN"
  | "BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL"
  | "BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL"
  | "BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL"
>;

export function getMissingProductionWorkerConfiguration(
  value: ProductionWorkerConfiguration,
): string[] {
  const missing: string[] = REQUIRED_PRODUCTION_WORKER_FLAGS.filter(
    (key) => value[key] !== true,
  );
  if (!value.SENTRY_DSN) missing.push("SENTRY_DSN");
  if (!value.BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL) {
    missing.push("BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL");
  }
  if (!value.BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL) {
    missing.push("BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL");
  }
  if (!value.BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL) {
    missing.push("BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL");
  }
  return missing;
}

export function getPausedWorkerFamilies(): Set<WorkerFamilyName> {
  const values = env.PAUSED_WORKER_FAMILIES.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const invalid = values.filter(
    (value): value is string => !WORKER_FAMILY_NAMES.includes(value as WorkerFamilyName),
  );
  if (invalid.length > 0) {
    throw new Error(`Invalid PAUSED_WORKER_FAMILIES values: ${invalid.join(", ")}`);
  }
  return new Set(values as WorkerFamilyName[]);
}

export function isWorkerFamilyPaused(name: WorkerFamilyName): boolean {
  return getPausedWorkerFamilies().has(name);
}

/** Fail a production worker fast instead of serving a deployment with missing job families. */
export function assertProductionWorkerConfiguration(): void {
  if (process.env.NODE_ENV !== "production" || env.RUNTIME_ROLE !== "worker") {
    return;
  }

  const missing = getMissingProductionWorkerConfiguration(env);

  if (missing.length > 0) {
    throw new Error(`Production worker configuration is incomplete: ${missing.join(", ")}`);
  }
}

export function requiresWorkerReadiness(): boolean {
  return process.env.NODE_ENV === "production" && env.RUNTIME_ROLE === "api";
}

export function isWorkerEnabled(value: boolean | undefined): boolean {
  if (env.RUNTIME_ROLE !== "worker") return false;
  return value ?? true;
}

/** Docs default on outside production; set ENABLE_API_DOCS to override. */
export function isApiDocsEnabled(): boolean {
  if (env.ENABLE_API_DOCS !== undefined) {
    return env.ENABLE_API_DOCS;
  }
  return process.env.NODE_ENV !== "production";
}

export function getVeoParallelVariants(): number {
  return env.VEO_PARALLEL_VARIANTS;
}

/**
 * BullMQ long-polls Redis while a queue is empty. Keeping this high avoids
 * spending Upstash commands on idle workers; Redis wakes the worker
 * immediately when a job is added, so it does not add job-start latency.
 */
export function getBullMqIdleDrainDelaySeconds(): number {
  return env.BULLMQ_IDLE_DRAIN_DELAY_SECONDS;
}
