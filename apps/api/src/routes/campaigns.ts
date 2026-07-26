import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  CampaignIdParamsSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { OUTREACH_CHANNELS } from "../lib/channels.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { parseSequence } from "../lib/sequence.js";
import { ensureCampaignStepZeroQueued } from "../services/campaign-step0-queue.js";
import {
  cancelCampaignPendingSequenceJobs,
  resumeCampaignSequenceJobs,
} from "../services/campaign-sequence-control.js";
import {
  parseChannelAccountsBody,
  resolveAndSyncCampaignChannelAccounts,
} from "../services/campaign-channel-accounts.js";
import {
  buildPrimaryCampaignVideoSummary,
  campaignVideoPaused,
} from "../lib/campaign-video-summary.js";

const ALLOWED_CHANNELS = OUTREACH_CHANNELS;

const LAUNCHABLE_STATUSES = ["draft", "review"] as const;
const PATCHABLE_STATUSES = ["active", "paused", "completed"] as const;

const SequenceStepSchema = z.object({
  type: z.string(),
  message: z.string(),
  delayHours: z.number(),
  subject: z.string().optional(),
});

const CampaignPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  status: z.enum(PATCHABLE_STATUSES).optional(),
  sequence: z.array(SequenceStepSchema).optional(),
  socialAccountId: z.string().trim().min(1).nullable().optional(),
  channelAccounts: z.record(z.string(), z.string()).optional(),
  channels: z.array(z.string()).min(1).optional(),
  archived: z.boolean().optional(),
});

const BulkCampaignPatchSchema = z.object({
  campaignIds: z.array(z.string().trim().min(1)).min(1).max(50),
  status: z.enum(["paused", "active", "completed"]).optional(),
  archived: z.boolean().optional(),
});

const CreateCampaignBodySchema = z.object({
  name: z.string().trim().min(1),
  channels: z.array(z.string()).min(1),
  sequence: z.array(SequenceStepSchema).min(1),
  socialAccountId: z.string().trim().min(1).optional(),
  channelAccounts: z.record(z.string(), z.string()).optional(),
});

const ListCampaignsQuerySchema = z.object({
  status: z.string().optional(),
});

const EnrollLeadsBodySchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1),
});

const CampaignLeadsQuerySchema = z.object({
  status: z.string().optional(),
});


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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCampaignArchived(aiConfig: unknown): boolean {
  return asRecord(aiConfig)?.archived === true;
}

function withArchivedFlag(aiConfig: unknown, archived: boolean): Prisma.InputJsonValue {
  const root = asRecord(aiConfig) ?? {};
  return { ...root, archived } as Prisma.InputJsonValue;
}

function withSequenceReviewComplete(aiConfig: unknown): Prisma.InputJsonValue {
  const root = asRecord(aiConfig) ?? {};
  return { ...root, requiresSequenceReview: false } as Prisma.InputJsonValue;
}

async function requireOrgCampaign(campaignId: string, orgId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.orgId !== orgId) throw new ForbiddenError();
  return campaign;
}

async function resolveLinkedInSender(input: {
  orgId: string;
  socialAccountId: string | null | undefined;
  channels: string[];
}): Promise<string | null> {
  if (!input.channels.includes("linkedin")) return null;
  if (!input.socialAccountId) {
    throw new ValidationError("Select an active LinkedIn sender for this campaign");
  }
  const sender = await prisma.socialAccount.findFirst({
    where: {
      id: input.socialAccountId,
      orgId: input.orgId,
      platform: "linkedin",
      status: "active",
    },
    select: { id: true, unipileId: true },
  });
  if (!sender?.unipileId) {
    throw new ValidationError("The selected LinkedIn sender is not active for this organization");
  }
  return sender.id;
}

async function resolveCampaignSenders(input: {
  orgId: string;
  campaignId?: string;
  channels: string[];
  sequence: unknown;
  socialAccountId?: string | null;
  channelAccounts?: Record<string, string> | null;
}) {
  const sequence = parseSequence(input.sequence);
  return resolveAndSyncCampaignChannelAccounts({
    orgId: input.orgId,
    campaignId: input.campaignId,
    channels: input.channels,
    sequence,
    socialAccountId: input.socialAccountId,
    channelAccounts: parseChannelAccountsBody(input.channelAccounts ?? null),
  });
}

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
        avatarUrl: true;
      };
    };
  };
}>;

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post("/campaigns", {
    schema: {
      ...authenticatedRoute("Campaigns", "Create campaign draft"),
      body: CreateCampaignBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { name, channels, sequence, socialAccountId, channelAccounts } = request.body;
    validateChannels(channels);

    const validatedSequence = parseSequenceOrThrow(sequence);
    const senders = await resolveCampaignSenders({
      orgId,
      channels,
      sequence: validatedSequence,
      socialAccountId,
      channelAccounts,
    });

    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        name,
        channels,
        sequence: validatedSequence,
        status: "draft",
        socialAccountId: senders.linkedInSocialAccountId,
      },
    });

    await resolveAndSyncCampaignChannelAccounts({
      orgId,
      campaignId: campaign.id,
      channels,
      sequence: parseSequence(validatedSequence),
      socialAccountId: senders.linkedInSocialAccountId,
      channelAccounts: senders.channelAccounts,
    });

    return reply.send(campaign);
  });

  r.get("/campaigns", {
    schema: {
      ...authenticatedRoute("Campaigns", "List campaigns"),
      querystring: ListCampaignsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { status } = request.query;

    const campaigns = await prisma.campaign.findMany({
      where: {
        orgId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({
      campaigns: campaigns.filter((campaign) => !isCampaignArchived(campaign.aiConfig)),
    });
  });

  r.get("/campaigns/:campaignId", {
    schema: {
      ...authenticatedRoute("Campaigns", "Get campaign detail"),
      params: CampaignIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        senderAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            status: true,
            avatarUrl: true,
          },
        },
        leads: {
          take: 8,
          orderBy: { createdAt: "desc" },
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
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();

    const [leadCount, messages, videoAssets, videoMessages] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId } }),
      prisma.message.findMany({
        where: { campaignId },
        select: { direction: true, status: true },
      }),
      prisma.videoAsset.findMany({
        where: { orgId, campaignId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, status: true, videoUrl: true, thumbnailUrl: true },
      }),
      prisma.message.findMany({
        where: { campaignId, direction: "outbound" },
        select: { content: true },
      }),
    ]);

    const sent = messages.filter(
      (message) => message.direction === "outbound" && ["sent", "delivered", "opened", "replied"].includes(message.status),
    ).length;
    const replies = messages.filter((message) => message.direction === "inbound").length;
    const meetings = campaign.leads.filter((row) => row.lead.status === "meeting").length;

    let sequence: unknown = campaign.sequence;
    try {
      sequence = parseSequence(campaign.sequence);
    } catch {
      sequence = campaign.sequence;
    }

    return reply.send({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      channels: campaign.channels,
      sequence,
      aiConfig: campaign.aiConfig,
      archived: isCampaignArchived(campaign.aiConfig),
      socialAccountId: campaign.socialAccountId,
      senderAccount: campaign.senderAccount,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      prospectCount: leadCount,
      metrics: {
        sent,
        replies,
        meetings,
        replyRate: sent === 0 ? null : Math.round((replies / sent) * 1000) / 10,
        meetingRate: sent === 0 ? null : Math.round((meetings / sent) * 1000) / 10,
      },
      video: buildPrimaryCampaignVideoSummary({
        aiConfig: campaign.aiConfig,
        assets: videoAssets,
        outboundContents: videoMessages.map((message) => message.content),
      }),
      leads: campaign.leads.map((campaignLead: CampaignLeadWithLead) => ({
        id: campaignLead.id,
        campaignLeadStatus: campaignLead.status,
        currentStep: campaignLead.currentStep,
        leadId: campaignLead.leadId,
        name: `${campaignLead.lead.firstName} ${campaignLead.lead.lastName}`.trim(),
        headline: campaignLead.lead.title,
        leadStatus: campaignLead.lead.status,
        linkedinUrl: campaignLead.lead.linkedinUrl,
        company: campaignLead.lead.company,
        avatarUrl: campaignLead.lead.avatarUrl,
      })),
      launchReady: {
        hasLeads: leadCount > 0,
        hasSequenceReview: asRecord(campaign.aiConfig)?.requiresSequenceReview !== true,
        hasSender:
          !campaign.channels.includes("linkedin") ||
          Boolean(
            campaign.senderAccount &&
              campaign.senderAccount.platform === "linkedin" &&
              campaign.senderAccount.status === "active",
          ),
        reasons: [
          ...(leadCount === 0 ? ["Add at least one approved prospect before launching."] : []),
          ...(asRecord(campaign.aiConfig)?.requiresSequenceReview === true
            ? ["Review and save the connection note before launching."]
            : []),
          ...(campaign.channels.includes("linkedin") &&
          !(
            campaign.senderAccount &&
            campaign.senderAccount.platform === "linkedin" &&
            campaign.senderAccount.status === "active"
          )
            ? ["Select an active LinkedIn sender before launching."]
            : []),
        ],
      },
    });
  });

  r.patch("/campaigns/bulk", {
    schema: {
      ...authenticatedRoute("Campaigns", "Bulk update campaigns"),
      body: BulkCampaignPatchSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const body = request.body;
    if (body.status === undefined && body.archived === undefined) {
      throw new ValidationError("status or archived is required");
    }

    const campaigns = await prisma.campaign.findMany({
      where: { orgId, id: { in: body.campaignIds } },
      select: { id: true, status: true, aiConfig: true },
    });
    if (campaigns.length === 0) throw new ValidationError("No matching campaigns found");

    const results: Array<{ id: string; status: string; archived: boolean }> = [];
    for (const campaign of campaigns) {
      const data: Prisma.CampaignUpdateInput = {};
      if (body.status) {
        if (body.status === "paused" && campaign.status !== "active" && campaign.status !== "paused") continue;
        if (body.status === "active" && campaign.status !== "paused" && campaign.status !== "active") continue;
        if (body.status === "completed" && !["active", "paused", "completed"].includes(campaign.status)) continue;
        data.status = body.status;
      }
      if (body.archived !== undefined) {
        data.aiConfig = withArchivedFlag(campaign.aiConfig, body.archived);
      }
      if (Object.keys(data).length === 0) continue;

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data,
      });
      if (body.status === "paused" || body.status === "completed") {
        await cancelCampaignPendingSequenceJobs({ campaignId: campaign.id, orgId });
      }
      if (body.status === "active" && campaign.status === "paused") {
        await resumeCampaignSequenceJobs({ campaignId: campaign.id, orgId });
      }
      results.push({
        id: updated.id,
        status: updated.status,
        archived: isCampaignArchived(updated.aiConfig),
      });
    }

    return reply.send({ updated: results.length, campaigns: results });
  });

  r.patch("/campaigns/:campaignId", {
    schema: {
      ...authenticatedRoute("Campaigns", "Update a campaign"),
      params: CampaignIdParamsSchema,
      body: CampaignPatchSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;
    const body = request.body;
    if (
      body.name === undefined &&
      body.status === undefined &&
      body.sequence === undefined &&
      body.socialAccountId === undefined &&
      body.channelAccounts === undefined &&
      body.channels === undefined &&
      body.archived === undefined
    ) {
      throw new ValidationError("At least one field is required");
    }
    const campaign = await requireOrgCampaign(campaignId, orgId);

    const nextChannels = body.channels ?? campaign.channels;
    if (body.channels) validateChannels(body.channels);

    const nextSequence =
      body.sequence !== undefined ? parseSequenceOrThrow(body.sequence) : campaign.sequence;

    // Pausing (or any metadata-only change) must not require a currently
    // healthy sender, an unhealthy sender is often the reason to pause.
    // Resuming, and any change that touches channel/sender config, still
    // needs a real sender resolved.
    const requiresSenderResolution =
      body.channels !== undefined ||
      body.sequence !== undefined ||
      body.socialAccountId !== undefined ||
      body.channelAccounts !== undefined ||
      body.status === "active";

    const senders = requiresSenderResolution
      ? await resolveCampaignSenders({
          orgId,
          campaignId,
          channels: nextChannels,
          sequence: nextSequence,
          socialAccountId:
            body.socialAccountId !== undefined ? body.socialAccountId : campaign.socialAccountId,
          channelAccounts: body.channelAccounts,
        })
      : null;

    if (body.status === "active" && !["paused", "active"].includes(campaign.status)) {
      throw new ValidationError(`Campaign cannot resume from status "${campaign.status}"`);
    }
    if (body.status === "paused" && campaign.status !== "active" && campaign.status !== "paused") {
      throw new ValidationError(`Campaign cannot pause from status "${campaign.status}"`);
    }
    if (body.status === "completed" && !["active", "paused", "completed"].includes(campaign.status)) {
      throw new ValidationError(`Campaign cannot complete from status "${campaign.status}"`);
    }

    const data: Prisma.CampaignUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.channels !== undefined) data.channels = body.channels;
    if (senders) {
      data.senderAccount = senders.linkedInSocialAccountId
        ? { connect: { id: senders.linkedInSocialAccountId } }
        : { disconnect: true };
    }
    if (body.sequence !== undefined) data.sequence = nextSequence as Prisma.InputJsonValue;
    const completesSequenceReview =
      body.sequence !== undefined && asRecord(campaign.aiConfig)?.requiresSequenceReview === true;
    if (completesSequenceReview || body.archived !== undefined) {
      const nextAiConfig = completesSequenceReview
        ? withSequenceReviewComplete(campaign.aiConfig)
        : (campaign.aiConfig as Prisma.InputJsonValue);
      data.aiConfig =
        body.archived !== undefined
          ? withArchivedFlag(nextAiConfig, body.archived)
          : nextAiConfig;
    }
    if (body.status !== undefined) data.status = body.status;

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data,
    });

    if (body.status === "paused" || body.status === "completed") {
      await cancelCampaignPendingSequenceJobs({ campaignId, orgId });
    }
    if (body.status === "active" && campaign.status === "paused") {
      await resumeCampaignSequenceJobs({ campaignId, orgId });
    }

    return reply.send({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      channels: updated.channels,
      socialAccountId: updated.socialAccountId,
      archived: isCampaignArchived(updated.aiConfig),
      videoPaused: campaignVideoPaused(updated.aiConfig),
      updatedAt: updated.updatedAt,
    });
  });

  r.post("/campaigns/:campaignId/duplicate", {
    schema: {
      ...authenticatedRoute("Campaigns", "Duplicate a campaign as draft"),
      params: CampaignIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;
    const source = await requireOrgCampaign(campaignId, orgId);

    const duplicate = await prisma.campaign.create({
      data: {
        orgId,
        name: `${source.name} (copy)`,
        channels: source.channels,
        sequence: source.sequence as Prisma.InputJsonValue,
        status: "draft",
        socialAccountId: source.socialAccountId,
        aiConfig: withArchivedFlag(source.aiConfig, false),
      },
    });

    return reply.send(duplicate);
  });

  r.post("/campaigns/:campaignId/leads", {
    schema: {
      ...authenticatedRoute("Campaigns", "Enroll approved leads into a campaign"),
      params: CampaignIdParamsSchema,
      body: EnrollLeadsBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;
    const { leadIds } = request.body;

    const campaign = await requireOrgCampaign(campaignId, orgId);

    const leadsInOrg = await prisma.lead.findMany({
      where: { id: { in: leadIds }, orgId },
      select: { id: true, reviewStatus: true },
    });

    if (leadsInOrg.length !== leadIds.length) {
      throw new ValidationError("One or more leadIds do not belong to this org");
    }
    if (leadsInOrg.some((lead) => lead.reviewStatus !== "approved")) {
      throw new ValidationError("Only approved prospects can be added to a campaign");
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

  r.post("/campaigns/:campaignId/launch", {
    schema: {
      ...authenticatedRoute("Campaigns", "Launch a draft/review campaign"),
      params: CampaignIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { leads: true, senderAccount: true },
    });

    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.orgId !== orgId) throw new ForbiddenError();
    if (isCampaignArchived(campaign.aiConfig)) {
      throw new ValidationError("Archived campaigns cannot be launched");
    }

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

    if (asRecord(campaign.aiConfig)?.requiresSequenceReview === true) {
      throw new ValidationError("Review and save the connection note before launching");
    }

    await resolveCampaignSenders({
      orgId,
      campaignId,
      channels: campaign.channels,
      sequence: campaign.sequence,
      socialAccountId: campaign.socialAccountId,
    });

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

  r.get("/campaigns/:campaignId/leads", {
    schema: {
      ...authenticatedRoute("Campaigns", "List campaign enrollments"),
      params: CampaignIdParamsSchema,
      querystring: CampaignLeadsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;
    const { status } = request.query;

    await requireOrgCampaign(campaignId, orgId);

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
            avatarUrl: true,
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
        avatarUrl: campaignLead.lead.avatarUrl,
      })),
      total: campaignLeads.length,
    });
  });
}
