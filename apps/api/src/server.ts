import Fastify from "fastify";
import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";
import "./config/env.js";
import { env, isWorkerEnabled, isWorkerFamilyPaused } from "./config/env.js";
import { apiErrorResponse } from "./lib/errors.js";
import { startBetterStackHeartbeat } from "./lib/better-stack.js";
import { installHttpErrorHandling } from "./lib/http-error-handler.js";
import { configureOperationalLogger } from "./lib/operational-logger.js";
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
import { publicPricingRoutes } from "./routes/public-pricing.js";
import { incidentWebhookRoutes } from "./routes/incident-webhooks.js";
import { incidentAutofixInternalRoutes } from "./routes/incident-autofix-internal.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";
import { startReconciliationMaintenanceWorker } from "./workers/reconcile-maintenance.js";
import { startVideoGenerationWorker } from "./workers/video-generation.js";
import { startAnalyticsInsightsWorker } from "./workers/analytics-insights.js";
import { startOnboardingProspectDiscoveryWorker } from "./workers/onboarding-prospect-discovery.js";
import { startIncidentAutofixWorker } from "./workers/incident-autofix.js";
import {
  recordWorkerActivity,
  startWorkerLeaseRenewal,
  type WorkerLeaseName,
} from "./lib/worker-leases.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  configureOperationalLogger(app.log);
  const workers: Array<{ close: () => Promise<void> }> = [];
  const stopHeartbeats: Array<() => void> = [];
  const activeLeaseNames: WorkerLeaseName[] = [];

  const registerWorker = <T extends {
    close: () => Promise<void>;
    on: (
      event: "failed" | "completed",
      listener: ((job: { id?: string } | undefined, error: Error) => void) | ((job: { id?: string } | undefined) => void),
    ) => unknown;
  }>(worker: T, name: string, leaseNames: WorkerLeaseName[] = []) => {
    worker.on("failed", (job, error) => {
      captureException(error, {
        operation: "queue-job-failed",
        worker: name,
        jobId: job?.id,
      });
    });
    worker.on("completed", () => {
      for (const leaseName of leaseNames) {
        void recordWorkerActivity(leaseName);
      }
    });
    activeLeaseNames.push(...leaseNames);
    workers.push(worker);
  };

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Unipile-Auth", "stripe-signature"],
    exposedHeaders: ["X-Request-Id"],
  });

  installHttpErrorHandling(app);

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
    errorResponseBuilder: (request, context) =>
      apiErrorResponse(
        request.id,
        429,
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${context.after}.`,
        { retryAfter: context.after },
      ),
  });

  await app.register(openapiPlugin);

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
  await app.register(incidentWebhookRoutes);
  await app.register(incidentAutofixInternalRoutes);
  await app.register(authRoutes);
  await app.register(anonymousDiscoveryRoutes);
  await app.register(publicPricingRoutes);
  await app.register(protectedRoutes);

  const campaignWorkerEnabled =
    isWorkerEnabled(env.ENABLE_CAMPAIGN_WORKER) && !isWorkerFamilyPaused("campaign");
  const reconcileWorkerEnabled =
    isWorkerEnabled(env.ENABLE_RECONCILE_WORKER) && !isWorkerFamilyPaused("reconcile");
  const videoWorkerEnabled =
    isWorkerEnabled(env.ENABLE_VIDEO_WORKER) && !isWorkerFamilyPaused("video");
  const analyticsInsightsWorkerEnabled =
    isWorkerEnabled(env.ENABLE_ANALYTICS_INSIGHTS_WORKER) && !isWorkerFamilyPaused("analytics");
  const lifecycleWorkerEnabled =
    isWorkerEnabled(env.ENABLE_LIFECYCLE_WORKER) && !isWorkerFamilyPaused("lifecycle");
  const incidentAutofixWorkerEnabled =
    isWorkerEnabled(env.ENABLE_INCIDENT_AUTOFIX_WORKER)
    && !isWorkerFamilyPaused("incident-autofix");

  if (campaignWorkerEnabled) {
    registerWorker(startCampaignSequenceWorker(), "campaign-sequence", ["campaign"]);
    registerWorker(startOnboardingProspectDiscoveryWorker(), "onboarding-prospect-discovery", ["campaign"]);
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
      [
        ...(reconcileWorkerEnabled ? ["reconcile" as const] : []),
        ...(lifecycleWorkerEnabled ? ["lifecycle" as const] : []),
      ],
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
    registerWorker(startVideoGenerationWorker(), "video-generation", ["video"]);
    stopHeartbeats.push(
      startBetterStackHeartbeat({
        name: "video-workers",
        url: env.BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL,
      }),
    );
  }

  if (analyticsInsightsWorkerEnabled) {
    registerWorker(startAnalyticsInsightsWorker(), "analytics-insights", ["analytics"]);
  }

  if (incidentAutofixWorkerEnabled) {
    registerWorker(startIncidentAutofixWorker(), "incident-autofix");
  }

  if (env.RUNTIME_ROLE === "worker" && activeLeaseNames.length > 0) {
    stopHeartbeats.push(
      startWorkerLeaseRenewal({
        names: [...new Set(activeLeaseNames)],
        logger: app.log,
      }),
    );
  }

  app.addHook("onClose", async () => {
    stopHeartbeats.forEach((stop) => stop());
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeRedisConnections();
  });

  return app;
}
