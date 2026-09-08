import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute, CampaignIdParamsSchema } from "../../../platform/http/openapi.js";
import { CampaignVideoEnableSchema } from "../state/dashboard-video.js";
import { enableDashboardVideo } from "../services/dashboard-video-enable.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export async function registerDashboardVideoEnableRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.post("/dashboard/campaigns/:campaignId/video/enable", {
    schema: {
      ...authenticatedRoute("Dashboard", "Generate a campaign video"),
      params: CampaignIdParamsSchema,
      body: CampaignVideoEnableSchema,
    },
  }, async (request, reply) => {
    return reply.send(await enableDashboardVideo(requireOrgId(request), request.params.campaignId, request.body.mode));
  });
}
