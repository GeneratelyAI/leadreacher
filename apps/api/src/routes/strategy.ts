import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { R2Adapter } from "../adapters/r2.js";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  errorResponses
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { requireOrgId } from "../lib/request-org.js";
import { VideoConfigSchema } from "../lib/billing/pricing.js";
import { OUTREACH_CHANNELS } from "../lib/channels.js";
import { runOutreachMessageAgent } from "../modules/agents/outreach-message-agent.js";
import {
  asRecord,
  buildStrategyBrief,
  generateStrategy,
  hasCompletedAudienceAnalysis,
  recordString,
  strategyBriefPersistence,
  toJson,
} from "../services/strategy-generation.js";

export {
  buildStrategyBrief,
  generateStrategy,
  resolveCompanySearchOutcome,
  strategyBriefPersistence,
  topBuyerPersonas,
} from "../services/strategy-generation.js";

const StrategyParamsSchema = z.object({
  orgId: z.string().min(1),
});

export const CAMPAIGN_TYPES = [
  "personalized_outreach",
  "ai_video_ad",
  "uploaded_video",
] as const;

type CampaignType = (typeof CAMPAIGN_TYPES)[number];

const CampaignTypeBodySchema = z.object({
  campaignType: z.string(),
});
const ChannelSelectionBodySchema = z.object({
  channels: z.array(z.enum(OUTREACH_CHANNELS)).min(1),
});
export const StrategyGenerationBodySchema = z.object({
  force: z.boolean().optional().default(false),
}).default({ force: false }).nullable().transform((body) => body ?? { force: false });

const VideoDecisionBodySchema = VideoConfigSchema;
const OutreachMessageBodySchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    ctaLabel: z.string().trim().min(1).max(80).nullable().default(null),
    ctaUrl: z.string().url().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
      ctx.addIssue({
        code: "custom",
        message: "A CTA needs both a label and a destination URL",
        path: value.ctaLabel ? ["ctaUrl"] : ["ctaLabel"],
      });
    }
  });
const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const STRATEGY_GENERATION_LOCK_TTL_MS = 10 * 60 * 1000;

async function releaseOwnedLock(lockKey: string, ownerToken: string): Promise<void> {
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0`,
    1,
    lockKey,
    ownerToken,
  );
}

function parseCampaignType(value: string): CampaignType {
  if (!CAMPAIGN_TYPES.includes(value as CampaignType)) {
    throw new ValidationError("Invalid campaign type");
  }

  return value as CampaignType;
}

function validateVideoDecisionForCampaign(
  campaignType: string | null,
  videoConfig: z.infer<typeof VideoDecisionBodySchema>,
): void {
  if (!videoConfig.enabled) {
    throw new ValidationError("Video is required for every campaign type");
  }

  if (!campaignType || !CAMPAIGN_TYPES.includes(campaignType as CampaignType)) {
    throw new ValidationError("Select a campaign type before configuring video");
  }

  if (campaignType === "personalized_outreach") {
    if (videoConfig.tone === null) {
      throw new ValidationError(
        "Personalized outreach requires a professional, casual, or aggressive tone",
      );
    }

    if (
      videoConfig.mode !== "personalized" ||
      videoConfig.source !== "generated"
    ) {
      throw new ValidationError(
        "Personalized outreach uses personalized AI-generated video",
      );
    }

    return;
  }

  if (campaignType === "ai_video_ad") {
    if (videoConfig.tone === null) {
      throw new ValidationError(
        "AI campaign video requires a professional, casual, or aggressive tone",
      );
    }

    if (
      videoConfig.mode !== "standardized" ||
      videoConfig.source !== "generated"
    ) {
      throw new ValidationError("AI campaign video uses one standardized AI-generated video");
    }

    return;
  }

  if (videoConfig.tone !== null) {
    throw new ValidationError("Uploaded video campaigns do not support a video tone");
  }

  if (
    videoConfig.mode !== null ||
    videoConfig.source !== "uploaded" ||
    videoConfig.uploadedVideoUrl === null
  ) {
    throw new ValidationError(
      "Uploaded video campaigns require a completed video upload",
    );
  }
}

function extensionForUpload(filename: string, contentType: string): string {
  const extension = extname(filename).toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(extension)) {
    return extension;
  }

  if (contentType === "video/quicktime") {
    return ".mov";
  }

  return ".mp4";
}

function isFileTooLargeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "FST_REQ_FILE_TOO_LARGE"
  );
}

export async function strategyRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_VIDEO_UPLOAD_BYTES,
    },
  });

  r.get("/strategy/:orgId", {
    schema: {
      ...authenticatedRoute("Strategy", "Get latest strategy for organization"),
      params: StrategyParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    return reply.send(strategy);
  });

  r.patch("/strategy/:orgId/campaign-type", {
    schema: {
      ...authenticatedRoute("Strategy", "Set campaign type"),
      params: StrategyParamsSchema,
      body: CampaignTypeBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const { campaignType } = request.body;
    const validatedCampaignType = parseCampaignType(campaignType);
    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    const updated = await prisma.strategy.update({
      where: { id: strategy.id },
      data: { campaignType: validatedCampaignType },
    });

    return reply.send(updated);
  });

  r.patch("/strategy/:orgId/channels", {
    schema: {
      ...authenticatedRoute("Strategy", "Set selected outreach channels"),
      params: StrategyParamsSchema,
      body: ChannelSelectionBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) throw new ForbiddenError();

    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) throw new NotFoundError("Strategy");

    const updated = await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        channels: toJson({
          ...asRecord(strategy.channels),
          selected: request.body.channels,
        }),
      },
    });

    return reply.send(updated);
  });

  r.patch("/strategy/:orgId/video-decision", {
    schema: {
      ...authenticatedRoute("Strategy", "Set video decision config"),
      params: StrategyParamsSchema,
      body: VideoDecisionBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const videoConfig = request.body;
    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    validateVideoDecisionForCampaign(strategy.campaignType, videoConfig);

    const updated = await prisma.strategy.update({
      where: { id: strategy.id },
      data: { videoConfig },
    });

    return reply.send(updated);
  });

  r.get("/strategy/:orgId/outreach-message", {
    schema: {
      ...authenticatedRoute("Strategy", "Get persisted outreach message"),
      params: StrategyParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    const messagingAngles = asRecord(strategy.messagingAngles);
    const existingCta = asRecord(messagingAngles.cta);
    return reply.send({
      message: recordString(messagingAngles, "outreachMessage") || null,
      ctaLabel: recordString(existingCta, "label") || null,
      ctaUrl: recordString(existingCta, "url") || null,
    });
  });

  r.post("/strategy/:orgId/outreach-message", {
    schema: {
      ...authenticatedRoute("Strategy", "Generate outreach message"),
      params: StrategyParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    const messagingAngles = asRecord(strategy.messagingAngles);
    const existingMessage = recordString(messagingAngles, "outreachMessage");
    const existingCta = asRecord(messagingAngles.cta);
    const ctaLabel = recordString(existingCta, "label") || null;
    const ctaUrl = recordString(existingCta, "url") || null;
    if (existingMessage) {
      return reply.send({ message: existingMessage, ctaLabel, ctaUrl });
    }

    const positioning = asRecord(strategy.positioning);
    const icpDefinition = asRecord(strategy.icpDefinition);
    const product =
      recordString(positioning, "businessModel") ||
      recordString(positioning, "strengths");
    const audience = recordString(icpDefinition, "idealCustomer");
    if (!product || !audience) {
      throw new ValidationError(
        "Complete your strategy before generating an outreach message",
      );
    }

    const videoConfig = asRecord(strategy.videoConfig);
    const storedTone = recordString(videoConfig, "tone");
    const tone =
      storedTone === "professional" ||
      storedTone === "casual" ||
      storedTone === "aggressive"
        ? storedTone
        : "professional";
    const result = await runOutreachMessageAgent({
      orgId,
      product,
      audience,
      tone,
    });

    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        messagingAngles: toJson({
          ...messagingAngles,
          outreachMessage: result.message,
        }),
      },
    });

    return reply.send({ message: result.message, ctaLabel, ctaUrl });
  });

  r.patch("/strategy/:orgId/outreach-message", {
    schema: {
      ...authenticatedRoute("Strategy", "Update outreach message"),
      params: StrategyParamsSchema,
      body: OutreachMessageBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const { message, ctaLabel, ctaUrl } = request.body;
    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }

    const messagingAngles = asRecord(strategy.messagingAngles);
    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        messagingAngles: toJson({
          ...messagingAngles,
          outreachMessage: message,
          cta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : null,
        }),
      },
    });

    return reply.send({ message, ctaLabel, ctaUrl });
  });

  r.post("/strategy/:orgId/video-upload", {
    schema: {
      ...authenticatedRoute("Strategy", "Upload campaign video (multipart)"),
      params: StrategyParamsSchema,
      // multipart body is not JSON; Scalar try-it is limited for this route
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { orgId: requestedOrgId } = request.params;
    if (requestedOrgId !== orgId) {
      throw new ForbiddenError();
    }

    const strategy = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });
    if (!strategy) {
      throw new NotFoundError("Strategy");
    }
    if (strategy.campaignType !== "uploaded_video") {
      throw new ValidationError(
        "Video uploads are only available for uploaded video campaigns",
      );
    }

    const file = await request.file();
    if (!file) {
      throw new ValidationError("Attach one video file");
    }
    if (!file.mimetype.startsWith("video/")) {
      throw new ValidationError("Uploaded file must have a video content type");
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (error) {
      if (isFileTooLargeError(error)) {
        throw new AppError(
          "Video uploads must be 200MB or smaller",
          413,
          "PAYLOAD_TOO_LARGE",
        );
      }
      throw error;
    }

    const key = [
      "strategy-uploads",
      orgId,
      `${randomUUID()}${extensionForUpload(file.filename, file.mimetype)}`,
    ].join("/");
    const { url } = await new R2Adapter().uploadBuffer(key, buffer, file.mimetype);
    const videoConfig = {
      enabled: true,
      mode: null,
      source: "uploaded" as const,
      tone: null,
      uploadedVideoUrl: url,
    };

    const updated = await prisma.strategy.update({
      where: { id: strategy.id },
      data: { videoConfig },
    });

    return reply.send(updated);
  });

  r.post(
    "/strategy/generate",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      schema: {
        ...authenticatedRoute("Strategy", "Generate strategy from discovery scrape"),
        body: StrategyGenerationBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const lockKey = `strategy:generate:lock:${orgId}`;
      const ownerToken = randomUUID();
      const acquired = await redis.set(
        lockKey,
        ownerToken,
        "PX",
        STRATEGY_GENERATION_LOCK_TTL_MS,
        "NX",
      );
      if (acquired !== "OK") {
        throw new AppError(
          "Strategy generation is already in progress for this organization.",
          409,
          "STRATEGY_GENERATION_IN_PROGRESS",
        );
      }

      const existing = await prisma.strategy.findFirst({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
      });

      const strategy =
        existing ??
        (await prisma.strategy.create({
          data: {
            orgId,
            icpDefinition: toJson({}),
            positioning: toJson({}),
            channels: toJson({}),
            messagingAngles: toJson({}),
            creativeAssets: toJson({}),
            executionPlan: toJson([]),
            completedSteps: [],
          },
        }));

      try {
        const currentIcpDefinition = asRecord(strategy.icpDefinition);
        if (
          hasCompletedAudienceAnalysis(strategy) &&
          asRecord(currentIcpDefinition.strategyBrief).status === "ready" &&
          !request.body.force
        ) {
          return reply.send(strategy);
        }

        const generated = await generateStrategy(strategy, orgId, request.dbUserId);
        return reply.send(generated);
      } finally {
        await releaseOwnedLock(lockKey, ownerToken).catch((error: unknown) => {
          request.log.error({ err: error, orgId }, "Failed to release strategy lock");
        });
      }
    },
  );
}
