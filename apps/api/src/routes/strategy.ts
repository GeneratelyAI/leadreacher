import type { Prisma, Strategy } from "@prisma/client";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import {
  ApifyAdapter,
  type CompanySearchResult,
  type ICPFilters,
  type ScrapedCompany,
  type ScrapedProfile,
} from "../adapters/apify.js";
import { resolveCompanyHeadcountCodes } from "../adapters/linkedin-company-size-codes.js";
import { resolveIndustryIds } from "../adapters/linkedin-industry-codes.js";
import { env } from "../config/env.js";
import { R2Adapter } from "../adapters/r2.js";
import {
  AppError,
  ExternalServiceError,
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
import { runOutreachMessageAgent } from "../modules/agents/outreach-message-agent.js";
import {
  buildCompanySearchPlan,
  COMPANY_SEARCH_NO_RESULTS_REASON,
  buildStrategyFilters,
  COMPANY_SEARCH_UNAVAILABLE_REASON,
} from "./strategy-filters.js";

type DiscoveryScrapeStatus = {
  status: "idle" | "running" | "completed" | "failed";
  url: string | null;
  market: string;
  offer: string;
  audience: string;
  value: string;
  strategyStatus: string;
  error: string | null;
  updatedAt: string;
};

type ChannelKey = "linkedin" | "email" | "whatsapp";

type ChannelRecommendation = {
  channel: ChannelKey;
  label: string;
  confidence: number;
  signalCount: number;
  totalProfiles: number;
  tag: string;
  description: string;
};

type StrategyIcpDefinition = {
  idealCustomer?: unknown;
  audienceAnalysis?: {
    status: "completed" | "failed";
    error?: string;
    generatedAt: string;
    companies: {
      status: "available" | "unavailable";
      reason?: string;
      totalFound: number;
      sampleSize: number;
    };
    decisionMakers: {
      totalFound: number;
      sampleSize: number;
    };
    reachability: {
      percentage: number;
      reachableProfiles: number;
      totalProfiles: number;
    };
    topIndustries: Array<{
      industry: string;
      count: number;
      percentage: number;
    }>;
    topBuyerPersonas: Array<{
      title: string;
      count: number;
    }>;
    filters: ICPFilters & {
      resolvedIndustryIds: number[];
      resolvedCompanyHeadcount: string[];
    };
  };
};

type AudienceAnalysis = NonNullable<StrategyIcpDefinition["audienceAnalysis"]>;

type StrategyChannels = {
  suggestedChannels?: unknown;
  recommendations?: ChannelRecommendation[];
};

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

const VideoDecisionBodySchema = VideoConfigSchema;
const OutreachMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
});
const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

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
        "AI video ads require a professional, casual, or aggressive tone",
      );
    }

    if (
      videoConfig.mode !== "standardized" ||
      videoConfig.source !== "generated"
    ) {
      throw new ValidationError("AI video ads use standardized AI-generated video");
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

function getScrapeStatusKey(orgId: string): string {
  return `discovery:scrape:${orgId}`;
}

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

async function getScrapeStatus(orgId: string): Promise<DiscoveryScrapeStatus | null> {
  const raw = await redis.get(getScrapeStatusKey(orgId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DiscoveryScrapeStatus;
  } catch {
    return null;
  }
}

function hasCompletedAudienceAnalysis(strategy: Strategy): boolean {
  const icpDefinition = asRecord(strategy.icpDefinition);
  const audienceAnalysis = asRecord(icpDefinition.audienceAnalysis);
  return audienceAnalysis.status === "completed";
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function normalizeIndustry(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "Unknown";
}

function topIndustries(companies: ScrapedCompany[]): AudienceAnalysis["topIndustries"] {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const industry = normalizeIndustry(company.industry);
    counts.set(industry, (counts.get(industry) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([industry, count]) => ({
      industry,
      count,
      percentage: percentage(count, companies.length),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function normalizeTitle(title: string): string {
  const cleaned = title
    .split(/\s+at\s+|\s+\|\s+|\s+-\s+/i)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown title";
}

export function topBuyerPersonas(
  profiles: ScrapedProfile[],
): AudienceAnalysis["topBuyerPersonas"] {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    const title = normalizeTitle(profile.title);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function isValidLinkedInUrl(value: string | undefined): boolean {
  return typeof value === "string" && /^https:\/\/(www\.)?linkedin\.com\/in\//i.test(value);
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveCompanySearchOutcome(
  companyResult: PromiseSettledResult<CompanySearchResult>,
): CompanySearchResult {
  if (companyResult.status === "fulfilled") {
    return companyResult.value;
  }

  return {
    companies: [],
    totalFound: 0,
    skipped: true,
    reason: COMPANY_SEARCH_UNAVAILABLE_REASON,
  };
}

function buildChannelRecommendations(profiles: ScrapedProfile[]): ChannelRecommendation[] {
  const total = profiles.length;
  const linkedinCount = profiles.filter((profile) => isValidLinkedInUrl(profile.linkedinUrl)).length;
  const emailCount = profiles.filter((profile) => hasText(profile.email)).length;
  const phoneCount = profiles.filter((profile) => hasText(profile.phone)).length;

  const recommendations: ChannelRecommendation[] = [
    {
      channel: "linkedin",
      label: "LinkedIn",
      confidence: percentage(linkedinCount, total),
      signalCount: linkedinCount,
      totalProfiles: total,
      tag: `${linkedinCount}/${total} profiles have LinkedIn URLs`,
      description: "Best for connecting with decision makers and building trust.",
    },
    {
      channel: "email",
      label: "Email",
      confidence: percentage(emailCount, total),
      signalCount: emailCount,
      totalProfiles: total,
      tag: `${emailCount}/${total} profiles include email data`,
      description: "Best when verified emails are available for direct follow-up.",
    },
    {
      channel: "whatsapp",
      label: "WhatsApp",
      confidence: percentage(phoneCount, total),
      signalCount: phoneCount,
      totalProfiles: total,
      tag: `${phoneCount}/${total} profiles include phone data`,
      description: "Useful only when phone coverage is present in the scraped profiles.",
    },
  ];

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

async function writeFilterAuditLog(input: {
  orgId: string;
  userId?: string;
  strategyId: string;
  filters: ICPFilters;
  companySearchFilters: ICPFilters;
  companySearchAvailable: boolean;
  companySearchReason?: string;
  resolvedIndustryIds: number[];
  resolvedCompanyHeadcount: string[];
}): Promise<void> {
  console.log(
    JSON.stringify({
      event: "strategy-apify-filters",
      orgId: input.orgId,
      strategyId: input.strategyId,
      filters: input.filters,
      resolvedIndustryIds: input.resolvedIndustryIds,
      resolvedCompanyHeadcount: input.resolvedCompanyHeadcount,
    }),
  );

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      action: "strategy.generate.filters",
      resource: "Strategy",
      resourceId: input.strategyId,
      metadata: toJson({
        filters: input.filters,
        companySearchFilters: input.companySearchFilters,
        companySearchAvailable: input.companySearchAvailable,
        companySearchReason: input.companySearchReason,
        resolvedIndustryIds: input.resolvedIndustryIds,
        resolvedCompanyHeadcount: input.resolvedCompanyHeadcount,
      }),
    },
  });
}

async function markStrategyGenerationFailed(
  strategy: Strategy,
  message: string,
): Promise<Strategy> {
  const icpDefinition = asRecord(strategy.icpDefinition);
  return prisma.strategy.update({
    where: { id: strategy.id },
    data: {
      icpDefinition: toJson({
        ...icpDefinition,
        audienceAnalysis: {
          status: "failed",
          error: message,
          generatedAt: new Date().toISOString(),
        },
      }),
    },
  });
}

function getDiscoveryInputs(
  strategy: Strategy,
  scrapeStatus: DiscoveryScrapeStatus | null,
): {
  market: string;
  offer: string;
  audience: string;
  value: string;
  competitiveAdvantage: string;
} {
  const positioning = asRecord(strategy.positioning);
  const icpDefinition = asRecord(strategy.icpDefinition);

  const market =
    scrapeStatus?.status === "completed" ? scrapeStatus.market : recordString(positioning, "industry");
  const offer =
    scrapeStatus?.status === "completed" ? scrapeStatus.offer : recordString(positioning, "businessModel");
  const audience =
    scrapeStatus?.status === "completed"
      ? scrapeStatus.audience
      : recordString(icpDefinition, "idealCustomer");
  const value = scrapeStatus?.status === "completed" ? scrapeStatus.value : "";
  const competitiveAdvantage = recordString(positioning, "strengths");

  if (!market || !offer || !audience || !competitiveAdvantage) {
    throw new ValidationError(
      "Discovery data is incomplete. Complete the discovery step before generating strategy.",
    );
  }

  return { market, offer, audience, value, competitiveAdvantage };
}

export async function generateStrategy(
  strategy: Strategy,
  orgId: string,
  userId?: string,
): Promise<Strategy> {
  const scrapeStatus = await getScrapeStatus(orgId);
  const discovery = getDiscoveryInputs(strategy, scrapeStatus);
  const filters = buildStrategyFilters({
    market: discovery.market,
    audience: discovery.audience,
    offer: discovery.offer,
    competitiveAdvantage: discovery.competitiveAdvantage,
  });
  const resolvedIndustryIds = resolveIndustryIds(filters.industries);
  const resolvedCompanyHeadcount = resolveCompanyHeadcountCodes(filters.companySizes);
  const companySearchPlan = buildCompanySearchPlan({
    filters,
    market: discovery.market,
    resolvedIndustryIds,
    resolvedCompanyHeadcount,
  });

  await writeFilterAuditLog({
    orgId,
    userId,
    strategyId: strategy.id,
    filters,
    companySearchFilters: companySearchPlan.filters,
    companySearchAvailable: companySearchPlan.canSearch,
    companySearchReason: companySearchPlan.reason,
    resolvedIndustryIds,
    resolvedCompanyHeadcount,
  });

  const adapter = new ApifyAdapter({ apiKey: env.APIFY_API_KEY });

  try {
    const companySearchPromise: Promise<CompanySearchResult> =
      companySearchPlan.canSearch
        ? adapter.searchCompanies(companySearchPlan.filters, 100)
        : Promise.resolve({
            companies: [],
            totalFound: 0,
            skipped: true,
            reason:
              companySearchPlan.reason ?? COMPANY_SEARCH_UNAVAILABLE_REASON,
          });
    const [companyResult, profileResult] = await Promise.allSettled([
      companySearchPromise,
      adapter.scrapeLeadsWithTotal(filters, 50),
    ]);
    if (profileResult.status === "rejected") {
      throw profileResult.reason instanceof Error
        ? profileResult.reason
        : new Error(String(profileResult.reason));
    }
    const { profiles, totalFound: profileTotalFound } = profileResult.value;

    if (companyResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "strategy-company-search-failed",
          orgId,
          strategyId: strategy.id,
          error:
            companyResult.reason instanceof Error
              ? companyResult.reason.message
              : String(companyResult.reason),
        }),
      );
    }
    const companySearch = resolveCompanySearchOutcome(companyResult);
    const { companies, totalFound: companyTotalFound } = companySearch;
    const companyDataUnavailable =
      companySearch.skipped ||
      companies.length === 0 ||
      companyTotalFound === 0;
    if (profiles.length === 0) {
      throw new ValidationError(
        "We couldn't complete your audience analysis because Apify returned zero decision makers. Try refining your discovery inputs and retry.",
      );
    }

    const reachableProfiles = profiles.filter((profile) => hasText(profile.email)).length;
    const icpDefinition = asRecord(strategy.icpDefinition) as StrategyIcpDefinition;
    const channels = asRecord(strategy.channels) as StrategyChannels;
    const now = new Date().toISOString();

    return await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        icpDefinition: toJson({
          ...icpDefinition,
          idealCustomer: icpDefinition.idealCustomer ?? discovery.audience,
          audienceAnalysis: {
            status: "completed",
            generatedAt: now,
            source: "apify",
            discovery: {
              market: discovery.market,
              offer: discovery.offer,
              audience: discovery.audience,
              value: discovery.value,
              competitiveAdvantage: discovery.competitiveAdvantage,
            },
            companies: {
              status: companyDataUnavailable ? "unavailable" : "available",
              ...(companyDataUnavailable && {
                reason:
                  companySearch.skipped
                    ? (companySearch.reason ?? COMPANY_SEARCH_UNAVAILABLE_REASON)
                    : COMPANY_SEARCH_NO_RESULTS_REASON,
              }),
              totalFound: companyTotalFound,
              sampleSize: companies.length,
            },
            decisionMakers: {
              totalFound: profileTotalFound,
              sampleSize: profiles.length,
            },
            reachability: {
              percentage: percentage(reachableProfiles, profiles.length),
              reachableProfiles,
              totalProfiles: profiles.length,
            },
            topIndustries: companyDataUnavailable ? [] : topIndustries(companies),
            topBuyerPersonas: topBuyerPersonas(profiles),
            filters: {
              ...filters,
              resolvedIndustryIds,
              resolvedCompanyHeadcount,
            },
          },
        }),
        channels: toJson({
          ...channels,
          recommendations: buildChannelRecommendations(profiles),
        }),
        completedSteps: [...new Set([...strategy.completedSteps, 1])],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markStrategyGenerationFailed(strategy, message);
    if (error instanceof ValidationError || error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError("Apify", message);
  }
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
    if (existingMessage) {
      return reply.send({ message: existingMessage });
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

    return reply.send({ message: result.message });
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

    const { message } = request.body;
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
        messagingAngles: toJson({ ...messagingAngles, outreachMessage: message }),
      },
    });

    return reply.send({ message });
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
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const lockKey = `strategy:generate:lock:${orgId}`;
      const acquired = await redis.set(lockKey, "1", "PX", 300000, "NX");
      if (acquired !== "OK") {
        return reply.code(409).send({
          error: "Strategy generation is already in progress for this organization.",
        });
      }

      try {
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

        if (hasCompletedAudienceAnalysis(strategy)) {
          return reply.send(strategy);
        }

        const generated = await generateStrategy(strategy, orgId, request.dbUserId);
        return reply.send(generated);
      } finally {
        await redis.del(lockKey);
      }
    },
  );
}
