import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";
import { ZodError } from "zod";
import "./config/env.js";
import { env, isWorkerEnabled } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { closeQueues } from "./lib/queue.js";
import { closeRedisConnections, redis } from "./lib/redis.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedRoutes } from "./plugins/protected-routes.js";
import { authRoutes } from "./routes/auth.js";
import { anonymousDiscoveryRoutes } from "./routes/discovery.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { stripeWebhookRoutes } from "./routes/stripe-webhook.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";
import { startReconcileRelationsWorker } from "./workers/reconcile-relations.js";
import { startDeliveryAttemptReconciliationWorker } from "./workers/reconcile-delivery-attempts.js";
import { startCampaignEnrollmentReconciliationWorker } from "./workers/reconcile-campaign-enrollments.js";
import {
  startVeoOperationReconciliationWorker,
  startVideoGenerationWorker,
} from "./workers/video-generation.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const workers: Array<{ close: () => Promise<void> }> = [];

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (request) =>
      request.orgId ?? request.dbUserId ?? request.userId ?? request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "RATE_LIMITED",
      message: `Rate limit exceeded. Try again in ${context.after}.`,
    }),
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
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(stripeWebhookRoutes);
  await app.register(authRoutes);
  await app.register(anonymousDiscoveryRoutes);
  await app.register(protectedRoutes);

  if (isWorkerEnabled(env.ENABLE_CAMPAIGN_WORKER)) {
    workers.push(startCampaignSequenceWorker());
  }

  if (isWorkerEnabled(env.ENABLE_RECONCILE_WORKER)) {
    workers.push(startReconcileRelationsWorker());
    workers.push(startDeliveryAttemptReconciliationWorker());
    workers.push(startCampaignEnrollmentReconciliationWorker());
  }

  if (isWorkerEnabled(env.ENABLE_VIDEO_WORKER)) {
    workers.push(startVideoGenerationWorker());
    workers.push(startVeoOperationReconciliationWorker());
  }

  app.addHook("onClose", async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeRedisConnections();
  });

  return app;
}
