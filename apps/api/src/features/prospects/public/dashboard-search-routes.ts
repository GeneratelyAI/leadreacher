import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { DashboardSearchQuerySchema } from "../state/dashboard-search.js";
import { searchDashboard } from "../services/dashboard-search.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export async function registerDashboardSearchRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/search", {
    schema: {
      ...authenticatedRoute("Dashboard", "Search prospects and campaigns"),
      querystring: DashboardSearchQuerySchema,
    },
  }, async (request, reply) => {
    return reply.send(await searchDashboard(requireOrgId(request), request.query));
  });
}
