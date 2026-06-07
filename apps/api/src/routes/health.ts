import type { FastifyPluginAsync } from "fastify";

type HealthResponse = {
  status: "ok";
  timestamp: string;
};

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });
};
