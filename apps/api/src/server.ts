import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import "./config/env.js";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedRoutes } from "./plugins/protected-routes.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";
import { startReconcileRelationsWorker } from "./workers/reconcile-relations.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }

    request.log.error(error);
    return reply.status(500).send({ error: "Internal error" });
  });

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(authRoutes);
  await app.register(protectedRoutes);

  startCampaignSequenceWorker();
  startReconcileRelationsWorker();

  return app;
}
