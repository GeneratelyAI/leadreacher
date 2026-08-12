import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { publicRoute } from "../lib/openapi.js";
import { redis } from "../lib/redis.js";
import { ServiceUnavailableError } from "../lib/errors.js";
import { requiresWorkerReadiness } from "../config/env.js";
import { getStaleWorkerLeases } from "../lib/worker-leases.js";

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
        const staleWorkers = requiresWorkerReadiness()
          ? await getStaleWorkerLeases()
          : [];
        if (staleWorkers.length > 0) {
          app.log.error({ staleWorkers }, "Required worker lease is stale");
          throw new ServiceUnavailableError(
            `Required background workers are unavailable: ${staleWorkers.join(", ")}`,
          );
        }
        reply.header("Cache-Control", "no-store");
        return { status: "ok" as const, timestamp: new Date().toISOString() };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          throw error;
        }
        app.log.error({ err: error }, "Readiness check failed");
        throw new ServiceUnavailableError("Database or cache is unavailable");
      }
    },
  );
};
