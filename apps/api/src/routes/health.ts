import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { publicRoute } from "../lib/openapi.js";
import { redis } from "../lib/redis.js";
import { ServiceUnavailableError } from "../lib/errors.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/health",
    {
      config: { rateLimit: false },
      schema: {
        ...publicRoute("Health", "Liveness probe"),
      },
    },
    async () => {
      return {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      };
    },
  );

  r.get(
    "/ready",
    {
      config: { rateLimit: false },
      schema: {
        ...publicRoute("Health", "Readiness probe (database + Redis)"),
      },
    },
    async (_request, reply) => {
      try {
        await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
        reply.header("Cache-Control", "no-store");
        return { status: "ok" as const, timestamp: new Date().toISOString() };
      } catch (error) {
        app.log.error({ err: error }, "Readiness check failed");
        throw new ServiceUnavailableError("Database or cache is unavailable");
      }
    },
  );
};
