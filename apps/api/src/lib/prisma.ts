import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "../config/env.js";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({ connectionString: env.DATABASE_URL });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pgPool = pool;
  globalForPrisma.prisma = prisma;
}
