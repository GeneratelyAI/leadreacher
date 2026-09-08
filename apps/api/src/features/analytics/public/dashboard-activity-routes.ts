import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { ActivityListQuerySchema } from "../state/activity.js";
import { getDashboardActivity } from "../services/dashboard-activity.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export { sortDashboardActivity } from "../state/activity.js";

export async function registerDashboardActivityRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/activity", {
    schema: {
      ...authenticatedRoute("Dashboard", "List operator activity feed"),
      querystring: ActivityListQuerySchema,
    },
  }, async (request, reply) => {
    return reply.send(await getDashboardActivity(requireOrgId(request), request.query));
  });
}
