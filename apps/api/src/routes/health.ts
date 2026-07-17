import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

type HealthResponse = {
  status: "ok";
  timestamp: string;
};

type ReadinessResponse = {
  status: "ok" | "unavailable";
  timestamp: string;
};

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>(
    "/health",
    { config: { rateLimit: false } },
    async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
      };
    },
  );

  app.get<{ Reply: ReadinessResponse }>("/ready", async (_request, reply) => {
    try {
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
      ]);
      return { status: "ok", timestamp: new Date().toISOString() };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      return reply.status(503).send({
        status: "unavailable",
        timestamp: new Date().toISOString(),
      });
    }
  });
};
