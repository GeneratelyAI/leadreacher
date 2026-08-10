import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { runOutreachMessageAgent } from "../modules/agents/outreach-message-agent.js";

const CompleteOnboardingResponseSchema = z.object({
  completed: z.literal(true),
  campaignId: z.string(),
  launched: z.boolean(),
  reviewRequired: z.boolean(),
  prospectCount: z.number().int().nonnegative(),
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

function strategyProspectLeadIds(icpDefinition: unknown): string[] {
  const analysis = asRecord(asRecord(icpDefinition).audienceAnalysis);
  const decisionMakers = asRecord(analysis.decisionMakers);
  const value = decisionMakers.prospectLeadIds;
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
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
  if (existing) {
    if (existing.status !== "active") {
      await prisma.campaign.update({
        where: { id: existing.id },
        data: {
          aiConfig: toJson({
            ...asRecord(existing.aiConfig),
            requiresSequenceReview: true,
          }),
        },
      });
    }
    return { id: existing.id, status: existing.status };
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
      }),
    },
    select: { id: true, status: true },
  });

  return campaign;
}

async function enrollOnboardingAudience(input: {
  orgId: string;
  campaignId: string;
  strategyIcpDefinition: unknown;
}): Promise<number> {
  const generatedLeadIds = strategyProspectLeadIds(input.strategyIcpDefinition);
  const leads = await prisma.lead.findMany({
    where: {
      orgId: input.orgId,
      ...(generatedLeadIds.length > 0
        ? { id: { in: generatedLeadIds } }
        : { source: "apify" }),
      reviewStatus: { in: ["pending", "approved"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, reviewStatus: true },
  });
  if (leads.length === 0) {
    throw new ValidationError(
      "No prospects are available for the first campaign. Retry audience analysis before finishing onboarding.",
    );
  }

  const leadIds = leads.map((lead) => lead.id);
  await prisma.campaignLead.createMany({
    data: leadIds.map((leadId) => ({ campaignId: input.campaignId, leadId })),
    skipDuplicates: true,
  });
  return leadIds.length;
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/onboarding/complete",
    {
      schema: {
        ...authenticatedRoute("Onboarding", "Mark onboarding complete"),
        response: {
          200: CompleteOnboardingResponseSchema,
          ...errorResponses,
        },
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

      const campaign = await ensureOnboardingCampaign({
        orgId,
        organizationName: organization.name,
        strategy,
        linkedinSenderId: linkedinSender.id,
      });

      const prospectCount =
        campaign.status === "active"
          ? 0
          : await enrollOnboardingAudience({
              orgId,
              campaignId: campaign.id,
              strategyIcpDefinition: strategy.icpDefinition,
            });

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
        prospectCount,
      });
    },
  );
}
