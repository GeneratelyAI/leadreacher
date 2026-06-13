import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import { parseSequence } from "../lib/sequence.js";

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

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns", async (request, reply) => {
    const { orgId, name, channels, sequence } = request.body as {
      orgId: string;
      name: string;
      channels: string[];
      sequence: unknown;
    };

    if (!orgId) throw new ValidationError("orgId is required");
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
    const { orgId, status } = request.query as {
      orgId: string;
      status?: string;
    };

    if (!orgId) throw new ValidationError("orgId is required");

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
    const { campaignId } = request.params as { campaignId: string };
    const { orgId } = request.query as { orgId: string };

    if (!orgId) throw new ValidationError("orgId is required");

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { leads: true },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ValidationError("Forbidden");

    return reply.send(campaign);
  });

  app.post("/campaigns/:campaignId/leads", async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string };
    const { orgId, leadIds } = request.body as {
      orgId: string;
      leadIds: string[];
    };

    if (!orgId) throw new ValidationError("orgId is required");
    if (!isNonEmptyArray<string>(leadIds)) {
      throw new ValidationError("leadIds must be a non-empty array");
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ValidationError("Forbidden");

    const leadsInOrg = await prisma.lead.findMany({
      where: { id: { in: leadIds }, orgId },
      select: { id: true },
    });

    if (leadsInOrg.length !== leadIds.length) {
      throw new ValidationError("One or more leadIds do not belong to this org");
    }

    const { count } = await prisma.campaignLead.createMany({
      data: leadIds.map((leadId) => ({
        campaignId,
        leadId,
      })),
      skipDuplicates: true,
    });

    return reply.send({ enrolled: count });
  });

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

    const jobs = campaign.leads.map((campaignLead) => ({
      name: QUEUE_CAMPAIGN_SEQUENCE,
      data: {
        campaignLeadId: campaignLead.id,
        orgId,
        step: 0,
      },
      opts: {
        jobId: campaignSequenceJobId(campaignLead.id, 0),
      },
    }));

    await campaignSequenceQueue.addBulk(jobs);

    return reply.send({ launched: true, jobCount: jobs.length });
  });
}
