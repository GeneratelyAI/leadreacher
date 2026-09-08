import { prisma } from "../../../platform/persistence/prisma.js";
import { analyticsInsightsQueue, QUEUE_ANALYTICS_INSIGHTS } from "../../../lib/queue.js";
import { readCachedAnalyticsInsights } from "../public/analytics-insights.js";

export async function requestAnalyticsInsights(orgId: string) {
  const cached = await readCachedAnalyticsInsights(orgId);
  if (cached) {
    return cached;
  }

  const sentCount = await prisma.message.count({
    where: {
      orgId,
      direction: "outbound",
      status: { in: ["sent", "delivered", "opened", "replied"] },
    },
  });
  if (sentCount === 0) {
    return {
      status: "no_data",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    };
  }

  await analyticsInsightsQueue.add(
    QUEUE_ANALYTICS_INSIGHTS,
    { orgId },
    {
      jobId: `analytics-insights-${orgId}`,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
  return {
    status: "aggregating",
    whatsWorking: [],
    whatsNotWorking: [],
    whatToDoNext: [],
  };
}
