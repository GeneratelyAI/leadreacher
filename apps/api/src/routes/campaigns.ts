import type { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns/:campaignId/launch", async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string };
    const { orgId } = request.body as { orgId: string };

    if (!orgId) throw new ValidationError("orgId is required");

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { leads: true },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ValidationError("Forbidden");

    const jobs = campaign.leads.map((campaignLead) => ({
      name: QUEUE_CAMPAIGN_SEQUENCE,
      data: {
        campaignLeadId: campaignLead.id,
        orgId,
        step: 0,
      },
    }));

    await campaignSequenceQueue.addBulk(jobs);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "active" },
    });

    return reply.send({ launched: true, jobCount: jobs.length });
  });
}
