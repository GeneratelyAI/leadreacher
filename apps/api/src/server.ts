import Fastify from "fastify";
import "./config/env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(prismaPlugin);
  await app.register(healthRoutes);

  return app;
}
