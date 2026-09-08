import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { OverviewQuerySchema } from "../state/overview.js";
import { getDashboardOverview } from "../services/dashboard-overview.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export { buildOverviewActivityTrend } from "../state/overview.js";

export async function registerDashboardOverviewRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/overview", {
    schema: {
      ...authenticatedRoute("Dashboard", "Workspace overview metrics"),
      querystring: OverviewQuerySchema,
    },
  }, async (request, reply) => {
    return reply.send(await getDashboardOverview(requireOrgId(request), request.query));
  });
}
