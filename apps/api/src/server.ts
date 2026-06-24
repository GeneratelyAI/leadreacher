import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import "./config/env.js";
import { env, isWorkerEnabled } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { closeQueues } from "./lib/queue.js";
import { closeRedisConnections } from "./lib/redis.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedRoutes } from "./plugins/protected-routes.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";
import { startReconcileRelationsWorker } from "./workers/reconcile-relations.js";
import { startVideoGenerationWorker } from "./workers/video-generation.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const workers: Array<{ close: () => Promise<void> }> = [];

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

  if (isWorkerEnabled(env.ENABLE_CAMPAIGN_WORKER)) {
    workers.push(startCampaignSequenceWorker());
  }

  if (isWorkerEnabled(env.ENABLE_RECONCILE_WORKER)) {
    workers.push(startReconcileRelationsWorker());
  }

  if (isWorkerEnabled(env.ENABLE_VIDEO_WORKER)) {
    workers.push(startVideoGenerationWorker());
  }

  app.addHook("onClose", async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeRedisConnections();
  });

  return app;
}
