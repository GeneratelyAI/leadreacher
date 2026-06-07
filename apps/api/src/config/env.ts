import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  UNIPILE_DSN: z.string().min(1),
  UNIPILE_API_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
