import { Job, Worker } from "bullmq";
import { getBullMqIdleDrainDelaySeconds } from "../config/env.js";
import {
  QUEUE_ANALYTICS_INSIGHTS,
  scheduleAnalyticsInsightsAggregation,
  type AnalyticsInsightsJob,
} from "../lib/queue.js";
import { redisSubscriber } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { aggregateOrganizationAnalyticsInsights } from "../services/analytics-insights.js";

async function runAnalyticsInsightsAggregation(
  job: AnalyticsInsightsJob,
): Promise<{ organizations: number }> {
  const organizationIds = job.orgId
    ? [job.orgId]
    : (
        await prisma.organization.findMany({
          where: {
            campaigns: { some: { status: { in: ["active", "completed"] } } },
          },
          select: { id: true },
        })
      ).map((organization) => organization.id);

  for (const orgId of organizationIds) {
    await aggregateOrganizationAnalyticsInsights(orgId);
  }
  return { organizations: organizationIds.length };
}

export function startAnalyticsInsightsWorker(): Worker<AnalyticsInsightsJob> {
  const worker = new Worker<AnalyticsInsightsJob>(
    QUEUE_ANALYTICS_INSIGHTS,
    (job: Job<AnalyticsInsightsJob>) => runAnalyticsInsightsAggregation(job.data),
    {
      connection: redisSubscriber,
      drainDelay: getBullMqIdleDrainDelaySeconds(),
    },
  );
  worker.on("failed", (job, error) => {
    console.error(`Analytics insight job ${job?.id} failed:`, error.message);
  });
  void scheduleAnalyticsInsightsAggregation();
  return worker;
}
