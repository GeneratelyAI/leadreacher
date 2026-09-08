import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";
import { AnalyticsQuerySchema } from "../state/analytics-query.js";
import { analyticsReport } from "../services/analytics-report.js";
import { requestAnalyticsInsights } from "../services/analytics-insight-request.js";

export { buildAnalyticsActivityTrend } from "../state/analytics-metrics.js";

export async function registerDashboardAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/analytics", {
    schema: {
      ...authenticatedRoute("Dashboard", "Analytics totals and breakdowns"),
      querystring: AnalyticsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    return reply.send(await analyticsReport(orgId, request.query));
  });

  r.get("/dashboard/analytics/insights", {
    schema: {
      ...authenticatedRoute("Dashboard", "Analytics insights (cached or queued)"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    return reply.send(await requestAnalyticsInsights(orgId));
  });
}
