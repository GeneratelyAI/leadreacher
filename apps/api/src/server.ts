import Fastify from "fastify";
import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";
import { ZodError } from "zod";
import "./config/env.js";
import { env, isWorkerEnabled } from "./config/env.js";
import { AppError, DailySendLimitError } from "./lib/errors.js";
import { startBetterStackHeartbeat } from "./lib/better-stack.js";
import { closeQueues } from "./lib/queue.js";
import { closeRedisConnections, redis } from "./lib/redis.js";
import { captureException } from "./lib/sentry.js";
import { openapiPlugin } from "./plugins/openapi.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedRoutes } from "./plugins/protected-routes.js";
import { authRoutes } from "./routes/auth.js";
import { anonymousDiscoveryRoutes } from "./routes/discovery.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { stripeWebhookRoutes } from "./routes/stripe-webhook.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";
import { startReconciliationMaintenanceWorker } from "./workers/reconcile-maintenance.js";
import { startVideoGenerationWorker } from "./workers/video-generation.js";
import { startAnalyticsInsightsWorker } from "./workers/analytics-insights.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const workers: Array<{ close: () => Promise<void> }> = [];
  const stopHeartbeats: Array<() => void> = [];

  const registerWorker = <T extends {
    close: () => Promise<void>;
    on: (
      event: "failed",
      listener: (job: { id?: string } | undefined, error: Error) => void,
    ) => unknown;
  }>(worker: T, name: string) => {
    worker.on("failed", (job, error) => {
      captureException(error, {
        operation: "queue-job-failed",
        worker: name,
        jobId: job?.id,
      });
    });
    workers.push(worker);
  };

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Unipile-Auth", "stripe-signature"],
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (request) => {
      const authorization = request.headers.authorization;
      if (!authorization) return request.ip;
      return `auth:${createHash("sha256").update(authorization).digest("hex")}`;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "RATE_LIMITED",
      message: `Rate limit exceeded. Try again in ${context.after}.`,
    }),
  });

  await app.register(openapiPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DailySendLimitError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message, resetAt: error.resetAt });
    }

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

    const fastifyError = error as { code?: string; statusCode?: number; message?: string };
    if (fastifyError.code === "FST_ERR_VALIDATION") {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: fastifyError.message ?? "Validation failed",
      });
    }

    request.log.error(error);
    captureException(error, {
      operation: "http-request-failed",
      method: request.method,
      route: request.routeOptions.url,
    });
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

  const campaignWorkerEnabled = isWorkerEnabled(env.ENABLE_CAMPAIGN_WORKER);
  const reconcileWorkerEnabled = isWorkerEnabled(env.ENABLE_RECONCILE_WORKER);
  const videoWorkerEnabled = isWorkerEnabled(env.ENABLE_VIDEO_WORKER);
  const analyticsInsightsWorkerEnabled = isWorkerEnabled(env.ENABLE_ANALYTICS_INSIGHTS_WORKER);
  const lifecycleWorkerEnabled = isWorkerEnabled(env.ENABLE_LIFECYCLE_WORKER);

  if (campaignWorkerEnabled) {
    registerWorker(startCampaignSequenceWorker(), "campaign-sequence");
    stopHeartbeats.push(
      startBetterStackHeartbeat({
        name: "campaign-worker",
        url: env.BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL,
      }),
    );
  }

  if (reconcileWorkerEnabled || videoWorkerEnabled || lifecycleWorkerEnabled) {
    registerWorker(
      startReconciliationMaintenanceWorker({
        reconcileEnabled: reconcileWorkerEnabled,
        videoEnabled: videoWorkerEnabled,
        lifecycleEnabled: lifecycleWorkerEnabled,
      }),
      "reconcile-maintenance",
    );
  }

  if (reconcileWorkerEnabled) {
    stopHeartbeats.push(
      startBetterStackHeartbeat({
        name: "reconcile-workers",
        url: env.BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL,
      }),
    );
  }

  if (videoWorkerEnabled) {
    registerWorker(startVideoGenerationWorker(), "video-generation");
    stopHeartbeats.push(
      startBetterStackHeartbeat({
        name: "video-workers",
        url: env.BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL,
      }),
    );
  }

  if (analyticsInsightsWorkerEnabled) {
    registerWorker(startAnalyticsInsightsWorker(), "analytics-insights");
  }

  app.addHook("onClose", async () => {
    stopHeartbeats.forEach((stop) => stop());
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeRedisConnections();
  });

  return app;
}
