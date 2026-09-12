import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../../../platform/http/errors.js";
import {
  CampaignIdParamsSchema,
  authenticatedRoute,
  errorResponses,
} from "../../../platform/http/openapi.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";
import { onboardingProspectDiscoveryQueue } from "../../../lib/queue.js";
import {
  onboardingStrategyFingerprint,
  withOnboardingDiscovery,
} from "../../prospects/public/onboarding-prospect-discovery.js";
import { formatCampaignName } from "../../../lib/campaign-naming.js";
import { OUTREACH_CHANNELS, type OutreachChannel } from "../../../lib/channels.js";

const CompleteOnboardingResponseSchema = z.object({
  completed: z.literal(true),
  campaignId: z.string(),
  launched: z.boolean(),
  reviewRequired: z.boolean(),
  prospectCount: z.number().int().nonnegative().optional(),
  discoveryStatus: z.enum(["queued", "running", "completed", "failed"]),
});

const CompleteOnboardingBodySchema = z.object({
  socialAccountId: z.string().trim().min(1).optional(),
});

type OnboardingCampaign = {
  id: string;
  status: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildConnectionNote(product: string): string {
  const compactProduct = product.replace(/\s+/g, " ").trim().slice(0, 170);
  return `Hi {{FirstName}}, I thought {{Company}} might benefit from ${compactProduct}. Open to connecting?`;
}

function outreachMessageWithCta(message: string, messagingAngles: Record<string, unknown>): string {
  const cta = asRecord(messagingAngles.cta);
  const label = recordString(cta, "label");
  const url = recordString(cta, "url");
  return label && url ? `${message}\n\n${label}: ${url}` : message;
}

function onboardingCampaignGoal(messagingAngles: Record<string, unknown>): string {
  const cta = asRecord(messagingAngles.cta);
  return recordString(cta, "label") || "Start conversations";
}

function selectedOutreachChannels(value: unknown): OutreachChannel[] {
  const selected = asRecord(value).selected;
  if (!Array.isArray(selected)) return [];
  return [...new Set(selected.flatMap((channel): OutreachChannel[] => {
    if (channel === "gmail" || channel === "outlook") return ["email"];
    return typeof channel === "string" && OUTREACH_CHANNELS.includes(channel as OutreachChannel) ? [channel as OutreachChannel] : [];
  }))];
}

function onboardingSequence(channels: OutreachChannel[], message: string, messagingAngles: Record<string, unknown>, product: string) {
  const finalMessage = outreachMessageWithCta(message, messagingAngles);
  return channels.flatMap((channel) => {
    if (channel === "linkedin") return [
      { type: "linkedin_invite", message: buildConnectionNote(product), delayHours: 0 },
      { type: "linkedin_message", message: finalMessage, delayHours: 24 },
    ];
    if (channel === "email") return [{ type: "email", subject: "A quick idea for {{Company}}", message: finalMessage, delayHours: 0 }];
    return [{ type: `${channel}_message`, message: finalMessage, delayHours: 0 }];
  });
}

async function syncOnboardingChannelAccounts(campaignId: string, accounts: Partial<Record<OutreachChannel, string>>): Promise<void> {
  const entries = Object.entries(accounts) as Array<[OutreachChannel, string]>;
  await prisma.$transaction([
    prisma.campaignChannelAccount.deleteMany({
      where: {
        campaignId,
        ...(entries.length > 0
          ? { channel: { notIn: entries.map(([channel]) => channel) } }
          : {}),
      },
    }),
    ...entries.map(([channel, socialAccountId]) =>
      prisma.campaignChannelAccount.upsert({
        where: { campaignId_channel: { campaignId, channel } },
        create: { campaignId, channel, socialAccountId },
        update: { socialAccountId },
      }),
    ),
  ]);
}

async function ensureOnboardingCampaign(input: {
  orgId: string;
  organizationName: string;
  strategy: {
    id: string;
    videoConfig: unknown;
    positioning: unknown;
    icpDefinition: unknown;
    messagingAngles: unknown;
  };
  channelAccounts: Partial<Record<OutreachChannel, string>>;
  selectedChannels: OutreachChannel[];
}): Promise<OnboardingCampaign> {
  const positioning = asRecord(input.strategy.positioning);
  const icpDefinition = asRecord(input.strategy.icpDefinition);
  const messagingAngles = asRecord(input.strategy.messagingAngles);
  const product =
    recordString(positioning, "businessModel") || recordString(positioning, "strengths");
  const audience = recordString(icpDefinition, "idealCustomer");

  if (!product || !audience) {
    throw new ValidationError(
      "Complete your strategy before creating the first campaign",
    );
  }

  const existing = await prisma.campaign.findFirst({
    where: {
      orgId: input.orgId,
      strategyId: input.strategy.id,
      aiConfig: { path: ["source"], equals: "onboarding" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, sequence: true, aiConfig: true },
  });
  const strategyFingerprint = onboardingStrategyFingerprint(input.strategy);
  const existingFingerprint = recordString(asRecord(existing?.aiConfig), "strategyFingerprint");
  if (existing && (existing.status === "active" || existingFingerprint === strategyFingerprint)) {
    if (existing.status !== "active") {
      await prisma.campaign.update({
        where: { id: existing.id },
        data: {
          socialAccountId: input.channelAccounts.linkedin ?? null,
          channels: input.selectedChannels,
          sequence: toJson(onboardingSequence(input.selectedChannels, recordString(asRecord(input.strategy.messagingAngles), "outreachMessage"), asRecord(input.strategy.messagingAngles), product)),
          aiConfig: withOnboardingDiscovery(
            {
              ...asRecord(existing.aiConfig),
              requiresSequenceReview: true,
              strategyFingerprint,
            },
            { status: "queued", prospectCount: 0 },
          ),
        },
      });
    }
    await syncOnboardingChannelAccounts(existing.id, input.channelAccounts);
    return { id: existing.id, status: existing.status };
  }

  if (existing) {
    await prisma.campaign.update({
      where: { id: existing.id },
      data: { aiConfig: toJson({ ...asRecord(existing.aiConfig), archived: true }) },
    });
  }

  const outreachMessage = recordString(messagingAngles, "outreachMessage");

  const naming = {
    audience: audience.replace(/\s+/g, " ").trim().slice(0, 72) || input.organizationName,
    channelLabel: input.selectedChannels.map((channel) => channel === "email" ? "Email" : channel.charAt(0).toUpperCase() + channel.slice(1)).join(" + "),
    goal: onboardingCampaignGoal(messagingAngles),
  };
  const campaignName = formatCampaignName(naming);
  const campaign = await prisma.campaign.create({
    data: {
      orgId: input.orgId,
      strategyId: input.strategy.id,
      name: campaignName,
      naming,
      status: "review",
      channels: input.selectedChannels,
      socialAccountId: input.channelAccounts.linkedin ?? null,
      sequence: toJson(onboardingSequence(input.selectedChannels, outreachMessage, messagingAngles, product)),
      aiConfig: toJson({
        source: "onboarding",
        requiresSequenceReview: true,
        video: input.strategy.videoConfig,
        strategyFingerprint,
        onboardingDiscovery: {
          status: "queued",
          prospectCount: 0,
          updatedAt: new Date().toISOString(),
        },
      }),
    },
    select: { id: true, status: true },
  });

  await syncOnboardingChannelAccounts(campaign.id, input.channelAccounts);

  return campaign;
}

async function queueOnboardingProspectDiscovery(input: {
  orgId: string;
  campaignId: string;
}): Promise<void> {
  const jobId = `onboarding-prospect-discovery-${input.campaignId}`;
  const existing = await onboardingProspectDiscoveryQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["active", "waiting", "delayed", "prioritized"].includes(state)) return;
    await existing.remove();
  }
  await onboardingProspectDiscoveryQueue.add(
    "discover-onboarding-prospects",
    input,
    { jobId },
  );
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/onboarding/complete",
    {
      schema: {
        ...authenticatedRoute("Onboarding", "Mark onboarding complete"),
        body: CompleteOnboardingBodySchema,
        response: {
          200: CompleteOnboardingResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const requestedSenderId = request.body.socialAccountId;
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, subscriptionStatus: true, onboardedAt: true },
      });

      if (!organization || (organization.subscriptionStatus !== "active" && organization.subscriptionStatus !== "trialing")) {
        throw new ForbiddenError("An active subscription is required to complete onboarding");
      }

      const strategy = await prisma.strategy.findFirst({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          videoConfig: true,
          positioning: true,
          icpDefinition: true,
          messagingAngles: true,
          channels: true,
        },
      });
      if (!strategy) {
        throw new ValidationError(
          "Complete your strategy before creating the first campaign draft",
        );
      }

      const selectedChannels = selectedOutreachChannels(strategy.channels);
      if (selectedChannels.length === 0) throw new ValidationError("Select at least one campaign channel before completing onboarding");
      const messagingAngles = asRecord(strategy.messagingAngles);
      if (!recordString(messagingAngles, "outreachMessage") || !recordString(messagingAngles, "outreachMessageApprovedAt")) {
        throw new ValidationError("Approve the campaign message before completing onboarding");
      }
      const activeAccounts = await prisma.socialAccount.findMany({
        where: { orgId, status: "active", platform: { in: selectedChannels } },
        orderBy: { createdAt: "asc" },
        select: { id: true, platform: true },
      });
      const channelAccounts: Partial<Record<OutreachChannel, string>> = {};
      for (const channel of selectedChannels) {
        const selected = activeAccounts.find((account) => account.platform === channel && (channel !== "linkedin" || !requestedSenderId || account.id === requestedSenderId));
        if (!selected) throw new ValidationError(`Connect an active ${channel} account before creating your first campaign`);
        channelAccounts[channel] = selected.id;
      }

      const campaign = await ensureOnboardingCampaign({
        orgId,
        organizationName: organization.name,
        strategy,
        channelAccounts,
        selectedChannels,
      });

      if (campaign.status !== "active") {
        await queueOnboardingProspectDiscovery({ orgId, campaignId: campaign.id });
      }

      if (!organization.onboardedAt) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardedAt: new Date() },
        });
      }

      return reply.send({
        completed: true as const,
        campaignId: campaign.id,
        launched: campaign.status === "active",
        reviewRequired: campaign.status !== "active",
        discoveryStatus: campaign.status === "active" ? "completed" : "queued",
      });
    },
  );

  r.post(
    "/onboarding/campaigns/:campaignId/discovery/retry",
    {
      schema: {
        ...authenticatedRoute("Onboarding", "Retry onboarding prospect discovery"),
        params: CampaignIdParamsSchema,
        response: { 200: z.object({ queued: z.literal(true) }), ...errorResponses },
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: request.params.campaignId,
          orgId,
          aiConfig: { path: ["source"], equals: "onboarding" },
          status: { not: "active" },
        },
        select: { id: true, aiConfig: true },
      });
      if (!campaign) throw new ValidationError("This onboarding campaign can no longer discover prospects.");

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { aiConfig: withOnboardingDiscovery(campaign.aiConfig, { status: "queued", prospectCount: 0 }) },
      });
      await queueOnboardingProspectDiscovery({ orgId, campaignId: campaign.id });
      return reply.send({ queued: true as const });
    },
  );
}
