import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { runOutreachMessageAgent } from "../modules/agents/outreach-message-agent.js";

const CompleteOnboardingResponseSchema = z.object({
  completed: z.literal(true),
  campaignId: z.string().nullable(),
});

const ONBOARDING_CAMPAIGN_REVIEW_MESSAGE = "Review this connection note before launch.";

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
}): Promise<string> {
  const existing = await prisma.campaign.findFirst({
    where: {
      orgId: input.orgId,
      strategyId: input.strategy.id,
      aiConfig: { path: ["source"], equals: "onboarding" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const positioning = asRecord(input.strategy.positioning);
  const icpDefinition = asRecord(input.strategy.icpDefinition);
  const messagingAngles = asRecord(input.strategy.messagingAngles);
  const product =
    recordString(positioning, "businessModel") || recordString(positioning, "strengths");
  const audience = recordString(icpDefinition, "idealCustomer");

  if (!product || !audience) {
    throw new ValidationError(
      "Complete your strategy before creating the first campaign draft",
    );
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

  const audienceLabel = audience.replace(/\s+/g, " ").trim().slice(0, 72);
  const campaignName = `${audienceLabel || input.organizationName} outreach`;
  const campaign = await prisma.campaign.create({
    data: {
      orgId: input.orgId,
      strategyId: input.strategy.id,
      name: campaignName,
      status: "review",
      channels: ["linkedin"],
      socialAccountId: input.linkedinSenderId,
      sequence: toJson([
        {
          type: "linkedin_invite",
          message: ONBOARDING_CAMPAIGN_REVIEW_MESSAGE,
          delayHours: 0,
        },
        {
          type: "linkedin_message",
          message: outreachMessage,
          delayHours: 24,
        },
      ]),
      aiConfig: toJson({
        source: "onboarding",
        requiresSequenceReview: true,
        video: input.strategy.videoConfig,
      }),
    },
    select: { id: true },
  });

  return campaign.id;
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/onboarding/complete",
    {
      schema: {
        ...authenticatedRoute("Onboarding", "Mark onboarding complete"),
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
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
        where: { orgId, platform: "linkedin", status: "active" },
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

      const campaignId = await ensureOnboardingCampaign({
        orgId,
        organizationName: organization.name,
        strategy,
        linkedinSenderId: linkedinSender.id,
      });

      if (!organization.onboardedAt) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardedAt: new Date() },
        });
      }

      return reply.send({ completed: true as const, campaignId });
    },
  );
}
