import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  CampaignIdParamsSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { onboardingProspectDiscoveryQueue } from "../lib/queue.js";
import { runOutreachMessageAgent } from "../modules/agents/outreach-message-agent.js";
import {
  onboardingStrategyFingerprint,
  withOnboardingDiscovery,
} from "../services/onboarding-prospect-discovery.js";
import { formatCampaignName } from "../lib/campaign-naming.js";

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

function videoTone(strategyVideoConfig: unknown): "professional" | "casual" | "aggressive" {
  const tone = recordString(asRecord(strategyVideoConfig), "tone");
  return tone === "casual" || tone === "aggressive" ? tone : "professional";
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
  linkedinSenderId: string;
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
          socialAccountId: input.linkedinSenderId,
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
    return { id: existing.id, status: existing.status };
  }

  if (existing) {
    await prisma.campaign.update({
      where: { id: existing.id },
      data: { aiConfig: toJson({ ...asRecord(existing.aiConfig), archived: true }) },
    });
  }

  let outreachMessage = recordString(messagingAngles, "outreachMessage");
  if (!outreachMessage) {
    const generated = await runOutreachMessageAgent({
      orgId: input.orgId,
      product,
      audience,
      tone: videoTone(input.strategy.videoConfig),
    });
    outreachMessage = generated.message;
    await prisma.strategy.update({
      where: { id: input.strategy.id },
      data: { messagingAngles: toJson({ ...messagingAngles, outreachMessage }) },
    });
  }

  const naming = {
    audience: audience.replace(/\s+/g, " ").trim().slice(0, 72) || input.organizationName,
    channelLabel: "LinkedIn",
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
      channels: ["linkedin"],
      socialAccountId: input.linkedinSenderId,
      sequence: toJson([
        {
          type: "linkedin_invite",
          message: buildConnectionNote(product),
          delayHours: 0,
        },
        {
          type: "linkedin_message",
          message: outreachMessageWithCta(outreachMessage, messagingAngles),
          delayHours: 24,
        },
      ]),
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

      if (!organization || organization.subscriptionStatus !== "active") {
        throw new ForbiddenError("An active subscription is required to complete onboarding");
      }

      const connectedAccountCount = await prisma.socialAccount.count({
        where: { orgId, status: "active" },
      });
      if (connectedAccountCount < 1) {
        throw new ValidationError(
          "Connect at least one active channel before completing onboarding",
        );
      }

      const linkedinSender = await prisma.socialAccount.findFirst({
        where: {
          orgId,
          platform: "linkedin",
          status: "active",
          ...(requestedSenderId ? { id: requestedSenderId } : {}),
        },
        select: { id: true },
      });
      if (!linkedinSender) {
        throw new ValidationError(
          "Connect an active LinkedIn channel before creating your first campaign",
        );
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
        },
      });
      if (!strategy) {
        throw new ValidationError(
          "Complete your strategy before creating the first campaign draft",
        );
      }

      const campaign = await ensureOnboardingCampaign({
        orgId,
        organizationName: organization.name,
        strategy,
        linkedinSenderId: linkedinSender.id,
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
