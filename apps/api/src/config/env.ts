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

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  UNIPILE_DSN: z.string().min(1),
  UNIPILE_API_KEY: z.string().min(1),
  UNIPILE_WEBHOOK_SECRET: z.string().min(1),
  APIFY_API_KEY: z.string().min(1),
  UPSTASH_REDIS_URL: z.string().min(1),
  UPSTASH_REDIS_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  GOOGLE_AI_API_KEY: z.string().optional().default(""),
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET_NAME: z.string().optional().default(""),
  R2_PUBLIC_URL: z.string().optional().default(""),
  VIDEO_MOCK_MODE: booleanString,
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
  VEO_PARALLEL_VARIANTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .default(DEFAULT_VEO_PARALLEL_VARIANTS),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;

if (env.VIDEO_MOCK_MODE && process.env.NODE_ENV === "production") {
  throw new Error("VIDEO_MOCK_MODE cannot be enabled in production");
}

export type Env = z.infer<typeof envSchema>;

export function isWorkerEnabled(value: boolean | undefined): boolean {
  return value ?? process.env.NODE_ENV === "production";
}

export function getVeoParallelVariants(): number {
  return env.VEO_PARALLEL_VARIANTS;
}
