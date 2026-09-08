import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute, CampaignIdParamsSchema } from "../../../platform/http/openapi.js";
import { CampaignVideoPatchSchema } from "../state/dashboard-video.js";
import { pauseDashboardVideo } from "../services/dashboard-video-pause.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";

export async function registerDashboardVideoPauseRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.patch("/dashboard/campaigns/:campaignId/video", {
    schema: {
      ...authenticatedRoute("Dashboard", "Pause or resume campaign video"),
      params: CampaignIdParamsSchema,
      body: CampaignVideoPatchSchema,
    },
  }, async (request, reply) => {
    return reply.send(await pauseDashboardVideo(requireOrgId(request), request.params.campaignId, request.body));
  });
}
