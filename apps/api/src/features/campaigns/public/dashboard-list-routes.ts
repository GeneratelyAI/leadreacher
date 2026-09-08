import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { DashboardCampaignsQuerySchema } from "../state/dashboard-list.js";
import { listDashboardCampaigns } from "../services/dashboard-list.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export { campaignMetricRate, campaignStatusFilter } from "../state/dashboard-list.js";

export async function registerDashboardListRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/campaigns", {
    schema: {
      ...authenticatedRoute("Dashboard", "List campaigns with operator summary"),
      querystring: DashboardCampaignsQuerySchema,
    },
  }, async (request, reply) => {
    return reply.send(await listDashboardCampaigns(requireOrgId(request), request.query));
  });
}
