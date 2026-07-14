import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { parseSequence } from "../lib/sequence.js";
import { ensureCampaignStepZeroQueued } from "../services/campaign-step0-queue.js";

const ALLOWED_CHANNELS = [
  "linkedin",
  "whatsapp",
  "instagram",
  "facebook",
  "email",
] as const;

const LAUNCHABLE_STATUSES = ["draft", "review"] as const;

function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function validateChannels(channels: string[]): void {
  const invalid = channels.filter(
    (channel) => !ALLOWED_CHANNELS.includes(channel as (typeof ALLOWED_CHANNELS)[number]),
  );
  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid channels: ${invalid.join(", ")}. Allowed: ${ALLOWED_CHANNELS.join(", ")}`,
    );
  }
}

function parseSequenceOrThrow(sequence: unknown): Prisma.InputJsonValue {
  try {
    return parseSequence(sequence) as Prisma.InputJsonValue;
  } catch {
    throw new ValidationError(
      "sequence must be a non-empty array of { type, message, delayHours }",
    );
  }
}

type CampaignLeadRecord = Prisma.CampaignLeadGetPayload<Record<string, never>>;

type CampaignLeadWithLead = Prisma.CampaignLeadGetPayload<{
  include: {
    lead: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        title: true;
        status: true;
        linkedinUrl: true;
        company: true;
      };
    };
  };
}>;

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { name, channels, sequence } = request.body as {
      name: string;
      channels: string[];
      sequence: unknown;
    };

    if (!name) throw new ValidationError("name is required");
    if (!isNonEmptyArray<string>(channels)) {
      throw new ValidationError("channels must be a non-empty array");
    }
    validateChannels(channels);

    const validatedSequence = parseSequenceOrThrow(sequence);

    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        name,
        channels,
        sequence: validatedSequence,
        status: "draft",
      },
    });

    return reply.send(campaign);
  });

  app.get("/campaigns", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { status } = request.query as {
      status?: string;
    };

    const campaigns = await prisma.campaign.findMany({
      where: {
        orgId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ campaigns });
  });

  app.get("/campaigns/:campaignId", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params as { campaignId: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { leads: true },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();

    return reply.send(campaign);
  });

  app.post("/campaigns/:campaignId/leads", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params as { campaignId: string };
    const { leadIds } = request.body as {
      leadIds: string[];
    };

    if (!isNonEmptyArray<string>(leadIds)) {
      throw new ValidationError("leadIds must be a non-empty array");
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();

    const leadsInOrg = await prisma.lead.findMany({
      where: { id: { in: leadIds }, orgId },
      select: { id: true },
    });

    if (leadsInOrg.length !== leadIds.length) {
      throw new ValidationError("One or more leadIds do not belong to this org");
    }

    const created = await prisma.$transaction(async (tx) => {
      const enrollments: Array<{ id: string }> = [];
      for (const leadId of new Set(leadIds)) {
        try {
          const enrollment = await tx.campaignLead.create({
            data: { campaignId, leadId },
            select: { id: true },
          });
          enrollments.push(enrollment);
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== "P2002"
          ) {
            throw error;
          }
        }
      }
      return enrollments;
    });

    let queued = 0;
    if (campaign.status === "active") {
      for (const enrollment of created) {
        try {
          const state = await ensureCampaignStepZeroQueued({
            campaignLeadId: enrollment.id,
            orgId,
          });
          if (state === "enqueued" || state === "pending") queued += 1;
        } catch (error) {
          request.log.error({ error, campaignLeadId: enrollment.id }, "step 0 queue unavailable; reconciler will retry");
        }
      }
    }

    return reply.send({ enrolled: created.length, queued });
  });

  app.post("/campaigns/:campaignId/launch", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params as { campaignId: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { leads: true },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();

    if (
      !LAUNCHABLE_STATUSES.includes(
        campaign.status as (typeof LAUNCHABLE_STATUSES)[number],
      )
    ) {
      throw new ValidationError(
        `Campaign cannot be launched from status "${campaign.status}"`,
      );
    }

    if (campaign.leads.length === 0) {
      throw new ValidationError("Campaign has no enrolled leads");
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "active" },
    });

    let jobCount = 0;
    for (const campaignLead of campaign.leads) {
      try {
        const state = await ensureCampaignStepZeroQueued({
          campaignLeadId: campaignLead.id,
          orgId,
        });
        if (state === "enqueued" || state === "pending") jobCount += 1;
      } catch (error) {
        request.log.error({ error, campaignLeadId: campaignLead.id }, "step 0 queue unavailable; reconciler will retry");
      }
    }

    return reply.send({ launched: true, jobCount });
  });

  app.get("/campaigns/:campaignId/leads", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params as { campaignId: string };
    const { status } = request.query as {
      status?: string;
    };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();

    const campaignLeads = await prisma.campaignLead.findMany({
      where: {
        campaignId,
        ...(status && { status }),
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            status: true,
            linkedinUrl: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({
      campaignId,
      leads: campaignLeads.map((campaignLead: CampaignLeadWithLead) => ({
        id: campaignLead.id,
        campaignLeadStatus: campaignLead.status,
        currentStep: campaignLead.currentStep,
        linkedinChatId: campaignLead.linkedinChatId,
        leadId: campaignLead.leadId,
        name: `${campaignLead.lead.firstName} ${campaignLead.lead.lastName}`.trim(),
        headline: campaignLead.lead.title,
        leadStatus: campaignLead.lead.status,
        linkedinUrl: campaignLead.lead.linkedinUrl,
        company: campaignLead.lead.company,
      })),
      total: campaignLeads.length,
    });
  });
}
