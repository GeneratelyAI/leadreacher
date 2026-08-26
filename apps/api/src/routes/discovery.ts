import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  LINKEDIN_INDUSTRY_CODES,
  resolveIndustryIds,
  type LinkedInIndustryCode,
} from "../adapters/linkedin-industry-codes.js";
import { callGroq } from "../lib/groq.js";
import {
  extractWebsiteUrlFromText,
  scrapeWebsiteMarkdown,
} from "../lib/firecrawl.js";
import { enrichFromUrl } from "../lib/link-enricher.js";
import { fetchWebsitePreviewImage } from "../lib/website-text.js";
import { ValidationError } from "../lib/errors.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  publicRoute,
  errorResponses
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

type ChatRole = "user" | "assistant";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type ParsedDiscoverySummary = {
  businessModel: string;
  industry: string;
  strengths: string;
  idealCustomer: string;
  suggestedChannels: string[];
  nextStep: string;
};

type DiscoverySummary = ParsedDiscoverySummary & {
  websiteEnriched: boolean;
  websiteImageUrl: string | null;
};

export type DiscoveryScrapeFields = {
  market: string;
  offer: string;
  audience: string;
  value: string;
  strategyStatus: string;
};

export type DiscoveryScrapeStatus = DiscoveryScrapeFields & {
  status: "idle" | "running" | "completed" | "failed";
  url: string | null;
  error: string | null;
  updatedAt: string;
};

const ALLOWED_CHANNELS = [
  "linkedin",
  "whatsapp",
  "instagram",
  "facebook",
  "email",
] as const;

const EMPTY_PARSED_SUMMARY: ParsedDiscoverySummary = {
  businessModel: "",
  industry: "",
  strengths: "",
  idealCustomer: "",
  suggestedChannels: [],
  nextStep: "",
};

const SUMMARY_SYSTEM_PROMPT = `Extract a structured summary from this onboarding conversation. Return ONLY valid JSON with no markdown:
{
  "businessModel": string,
  "industry": string,
  "strengths": string,
  "idealCustomer": string,
  "suggestedChannels": string[],
  "nextStep": string
}

All values must use formal, professional business language in complete sentences or polished phrases. Every string must begin with a capital letter. Use sentence case throughout - never Title Case or ALL CAPS. End full-sentence fields with proper punctuation.

Field guidance:
- businessModel: what the business sells or does (from the first user answer); one concise formal phrase
- industry: return a specific descriptor like 'B2B SaaS / sales technology' or 'Fintech / payments infrastructure', not just 'SaaS' or 'tech'. Be specific. (from the first user answer)
- strengths: differentiators (from the second user answer); one concise formal phrase
- idealCustomer: ICP - title, company size, location (from the third user answer); one concise formal phrase
- suggestedChannels: best outreach channels for their goal (from the fourth user answer); values must be from ["linkedin","whatsapp","instagram","facebook","email"]
- nextStep: Write one formal, concrete forward-looking action sentence based on the business, ICP, and suggested channels. Example: 'Launch a LinkedIn sequence targeting RevOps leaders at B2B SaaS companies, leading with your unified data enrichment advantage.' Only populate this once suggestedChannels is non-empty, otherwise return empty string.

If a field cannot be inferred yet, return an empty string or empty array for suggestedChannels.`;

export const SCRAPE_STATUS_TTL_SECONDS = 60 * 60;
export const ANON_SCRAPE_STATUS_TTL_SECONDS = 30 * 60;

const DiscoveryScrapeBodySchema = z.object({
  url: z.string().trim().min(1, "url is required"),
});

export const AnonScrapeIdSchema = z.string().uuid();

const AnonymousDiscoveryScrapeBodySchema = DiscoveryScrapeBodySchema.extend({
  anonId: AnonScrapeIdSchema,
});

const AnonymousDiscoveryScrapeStatusQuerySchema = z.object({
  anonId: AnonScrapeIdSchema,
});

const DiscoverySummaryBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
}).passthrough();

const DiscoveryCompleteBodySchema = z.object({
  summary: z.object({
    businessModel: z.string().trim().min(1),
    industry: z.string().trim().min(1),
    strengths: z.string().trim().min(1),
    idealCustomer: z.string().trim().min(1),
    suggestedChannels: z.array(z.string()).optional(),
    nextStep: z.string().optional(),
    websiteEnriched: z.boolean().optional(),
    websiteImageUrl: z.string().nullable().optional(),
  }).passthrough(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
});

const SCRAPE_SYSTEM_PROMPT = `You analyze a company website for B2B outreach onboarding. Return ONLY valid JSON with no markdown:
{
  "market": string,
  "offer": string,
  "audience": string,
  "value": string,
  "strategyStatus": string
}

Field guidance:
- market: the company's market or industry, concise phrase.
- offer: what the company sells or provides, concise phrase.
- audience: likely buyer/persona, concise phrase.
- value: core value proposition or competitive advantage, concise phrase.
- strategyStatus: one sentence describing the outreach strategy being built.

Use polished business language. If context is weak, infer conservatively from the website URL/domain.`;

const INDUSTRY_RECLASSIFICATION_CANDIDATE_LIMIT = 25;
const INDUSTRY_RECLASSIFICATION_SYSTEM_PROMPT = `You classify a business into LinkedIn's industry taxonomy.

Choose exactly one industry name from the provided CANDIDATES list, copied verbatim, or return exactly NONE when none genuinely fits. Do not explain your choice, do not invent an industry, and do not return an ID.`;

const INDUSTRY_SHORTLIST_STOP_WORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "to",
  "in",
  "with",
  "services",
  "service",
  "industry",
  "industries",
  "business",
  "businesses",
  "platform",
]);

function requireOrgId(request: { orgId?: string }): string {
  if (!request.orgId) {
    throw new Error("orgId missing after auth middleware");
  }
  return request.orgId;
}

function isChatRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant";
}

function parseMessages(body: unknown): IncomingMessage[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    throw new ValidationError("messages must be an array");
  }

  const messages = (body as { messages: unknown[] }).messages;
  if (messages.length === 0) {
    throw new ValidationError("messages must not be empty");
  }

  return messages.map((message, index) => {
    if (
      !message ||
      typeof message !== "object" ||
      !isChatRole((message as IncomingMessage).role) ||
      typeof (message as IncomingMessage).content !== "string" ||
      !(message as IncomingMessage).content.trim()
    ) {
      throw new ValidationError(`Invalid message at index ${index}`);
    }

    return {
      role: (message as IncomingMessage).role,
      content: (message as IncomingMessage).content.trim(),
    };
  });
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function emptyScrapeStatus(
  status: DiscoveryScrapeStatus["status"],
  url: string | null,
  error: string | null = null,
): DiscoveryScrapeStatus {
  return {
    status,
    url,
    market: "",
    offer: "",
    audience: "",
    value: "",
    strategyStatus: "",
    error,
    updatedAt: new Date().toISOString(),
  };
}

export function orgScrapeStatusKey(orgId: string): string {
  return `discovery:scrape:${orgId}`;
}

export function anonScrapeStatusKey(anonId: string): string {
  return `discovery:anon-scrape:${anonId}`;
}

export function anonScrapeClaimKey(anonId: string): string {
  return `discovery:anon-scrape-claim:${anonId}`;
}

export async function setScrapeStatus(
  statusKey: string,
  status: DiscoveryScrapeStatus,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(
    statusKey,
    JSON.stringify(status),
    "EX",
    ttlSeconds,
  );
}

export async function getScrapeStatus(
  statusKey: string,
): Promise<DiscoveryScrapeStatus | null> {
  const raw = await redis.get(statusKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DiscoveryScrapeStatus;
  } catch {
    return null;
  }
}

function cleanScrapeField(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : "";
}

function tokenizeIndustryShortlistText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length > 1 && !INDUSTRY_SHORTLIST_STOP_WORDS.has(token),
    );
}

function scoreIndustryShortlistCandidate(
  sourceText: string,
  industry: LinkedInIndustryCode,
): number {
  const sourceTokens = tokenizeIndustryShortlistText(sourceText);
  if (sourceTokens.length === 0) {
    return 0;
  }

  const labelTokens = new Set(tokenizeIndustryShortlistText(industry.label));
  const hierarchyTokens = new Set(
    tokenizeIndustryShortlistText(industry.hierarchy),
  );
  let score = 0;

  for (const token of sourceTokens) {
    if (labelTokens.has(token)) {
      score += 3;
    } else if (hierarchyTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

export function buildIndustryReclassificationShortlist(
  fields: Pick<DiscoveryScrapeFields, "market" | "offer" | "audience">,
  limit = INDUSTRY_RECLASSIFICATION_CANDIDATE_LIMIT,
): LinkedInIndustryCode[] {
  const sourceText = [fields.market, fields.offer, fields.audience]
    .filter(Boolean)
    .join("\n");

  return LINKEDIN_INDUSTRY_CODES.map((industry) => ({
    industry,
    score: scoreIndustryShortlistCandidate(sourceText, industry),
  }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.industry.label.localeCompare(right.industry.label),
    )
    .slice(0, limit)
    .map((candidate) => candidate.industry);
}

/**
 * Constrains a free-form scrape market to a verified LinkedIn industry label
 * before Strategy can use it for paid Apify searches. The LLM may only choose
 * from a small local shortlist; every choice is resolved again locally.
 */
export async function repairUnresolvedDiscoveryMarket(
  fields: DiscoveryScrapeFields,
): Promise<DiscoveryScrapeFields> {
  if (!fields.market || resolveIndustryIds([fields.market]).length > 0) {
    return fields;
  }

  const candidates = buildIndustryReclassificationShortlist(fields);
  if (candidates.length === 0) {
    return fields;
  }

  try {
    const candidateLabels = candidates.map((candidate) => candidate.label);
    const response = await callGroq(
      INDUSTRY_RECLASSIFICATION_SYSTEM_PROMPT,
      [
        {
          role: "user",
          content: `MARKET: ${fields.market}\nOFFER: ${fields.offer}\nAUDIENCE: ${fields.audience}\n\nCANDIDATES:\n${candidateLabels.map((label) => `- ${label}`).join("\n")}`,
        },
      ],
      120,
    );
    const proposedLabel = response.trim();

    // Do not normalize or reinterpret the LLM response: it must be an exact
    // candidate label, then resolve through the same canonical lookup.
    if (!candidateLabels.includes(proposedLabel)) {
      return fields;
    }
    if (resolveIndustryIds([proposedLabel]).length === 0) {
      return fields;
    }

    return { ...fields, market: proposedLabel };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discovery-industry-reclassification",
        path: "reclassification-failed",
        market: fields.market,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return fields;
  }
}

function parseScrapeResponse(raw: string): DiscoveryScrapeFields {
  const jsonText = extractJsonObject(raw);
  const parsed = JSON.parse(jsonText) as Partial<DiscoveryScrapeFields>;

  return {
    market: cleanScrapeField(parsed.market),
    offer: cleanScrapeField(parsed.offer),
    audience: cleanScrapeField(parsed.audience),
    value: cleanScrapeField(parsed.value),
    strategyStatus: cleanScrapeField(parsed.strategyStatus),
  };
}

function normalizeScrapeUrl(input: string): string {
  const extracted = extractWebsiteUrlFromText(input);
  if (!extracted) {
    throw new ValidationError("url must be a valid website domain or URL");
  }

  return extracted;
}

export function resolveScrapeTerminalStatus(
  fields: DiscoveryScrapeFields,
): "completed" | "failed" {
  return Boolean(
    fields.market || fields.offer || fields.audience || fields.value,
  )
    ? "completed"
    : "failed";
}

async function runDiscoveryScrape(
  statusKey: string,
  url: string,
  ttlSeconds: number,
  anonymousScrapeId?: string,
): Promise<void> {
  async function persist(status: DiscoveryScrapeStatus): Promise<void> {
    await setScrapeStatus(statusKey, status, ttlSeconds);
    if (!anonymousScrapeId) return;

    const claimedOrgId = await redis.get(anonScrapeClaimKey(anonymousScrapeId));
    if (!claimedOrgId) return;

    await setScrapeStatus(
      orgScrapeStatusKey(claimedOrgId),
      status,
      SCRAPE_STATUS_TTL_SECONDS,
    );
    if (status.status === "completed" || status.status === "failed") {
      await Promise.all([
        redis.del(anonScrapeClaimKey(anonymousScrapeId)),
        redis.del(anonScrapeStatusKey(anonymousScrapeId)),
      ]);
    }
  }

  try {
    const markdown = await scrapeWebsiteMarkdown(url);
    if (markdown.trim().length === 0) {
      await persist(
        emptyScrapeStatus(
          "failed",
          url,
          "We couldn't read your website content. Please double-check the URL or enter your details manually.",
        ),
      );
      return;
    }

    const context = markdown;
    const raw = await callGroq(
      SCRAPE_SYSTEM_PROMPT,
      [
        {
          role: "user",
          content: `Analyze this website context for outreach onboarding:\n\n${context}`,
        },
      ],
      500,
      { jsonObject: true },
    );
    const fields = await repairUnresolvedDiscoveryMarket(
      parseScrapeResponse(raw),
    );
    const terminalStatus = resolveScrapeTerminalStatus(fields);

    await persist(
      {
        ...emptyScrapeStatus(terminalStatus, url),
        ...fields,
        status: terminalStatus,
        error:
          terminalStatus === "failed"
            ? "We couldn't extract enough detail from your website. Please enter your details manually."
            : null,
        updatedAt: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error("[discovery] Website analysis failed", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    await persist(
      emptyScrapeStatus(
        "failed",
        url,
        "Website analysis is temporarily busy. Please try again in a moment.",
      ),
    );
  }
}

function normalizeChannel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ALLOWED_CHANNELS.includes(
    normalized as (typeof ALLOWED_CHANNELS)[number],
  )
    ? normalized
    : null;
}

function normalizeSummaryText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function parseSummaryResponse(raw: string): ParsedDiscoverySummary {
  const jsonText = extractJsonObject(raw);

  try {
    const parsed = JSON.parse(jsonText) as Partial<ParsedDiscoverySummary>;
    const suggestedChannels = Array.isArray(parsed.suggestedChannels)
      ? [
          ...new Set(
            parsed.suggestedChannels
              .map((channel) => normalizeChannel(channel))
              .filter((channel): channel is string => channel !== null),
          ),
        ]
      : [];

    const nextStep =
      suggestedChannels.length > 0
        ? normalizeSummaryText(parsed.nextStep)
        : "";

    return {
      businessModel: normalizeSummaryText(parsed.businessModel),
      industry: normalizeSummaryText(parsed.industry),
      strengths: normalizeSummaryText(parsed.strengths),
      idealCustomer: normalizeSummaryText(parsed.idealCustomer),
      suggestedChannels,
      nextStep,
    };
  } catch {
    return EMPTY_PARSED_SUMMARY;
  }
}

function formatConversation(messages: IncomingMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function findWebsiteUrl(messages: IncomingMessage[]): string | null {
  let lastUrl: string | null = null;

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const url = extractWebsiteUrlFromText(message.content);
    if (url) {
      lastUrl = url;
    }
  }

  return lastUrl;
}

async function buildSummarySystemPrompt(
  messages: IncomingMessage[],
): Promise<{
  systemPrompt: string;
  websiteEnriched: boolean;
  websiteImageUrl: string | null;
}> {
  const websiteUrl = findWebsiteUrl(messages);
  if (!websiteUrl) {
    return {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      websiteEnriched: false,
      websiteImageUrl: null,
    };
  }

  const markdown = await enrichFromUrl(websiteUrl);
  const previewImageUrl = await fetchWebsitePreviewImage(websiteUrl);
  if (!markdown) {
    return {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      websiteEnriched: false,
      websiteImageUrl: previewImageUrl,
    };
  }

  return {
    systemPrompt: `Website context for this business:\n${markdown}\n\nUse this to enrich the summary, especially nextStep.\n\n${SUMMARY_SYSTEM_PROMPT}`,
    websiteEnriched: true,
    websiteImageUrl: previewImageUrl,
  };
}

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/discovery/scrape",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      schema: {
        ...authenticatedRoute("Discovery", "Start website discovery scrape"),
        body: DiscoveryScrapeBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { url: rawUrl } = request.body;
      const url = normalizeScrapeUrl(rawUrl);
      const runningStatus = emptyScrapeStatus("running", url);
      const statusKey = orgScrapeStatusKey(orgId);

      await setScrapeStatus(statusKey, runningStatus, SCRAPE_STATUS_TTL_SECONDS);
      void runDiscoveryScrape(statusKey, url, SCRAPE_STATUS_TTL_SECONDS);

      return reply.send(runningStatus);
    },
  );

  r.get("/discovery/scrape-status", {
    schema: {
      ...authenticatedRoute("Discovery", "Get discovery scrape status"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    return reply.send(
      (await getScrapeStatus(orgScrapeStatusKey(orgId))) ??
        emptyScrapeStatus("idle", null),
    );
  });

  r.post("/discovery/summary", {
    schema: {
      ...authenticatedRoute("Discovery", "Generate discovery summary from chat messages"),
      body: DiscoverySummaryBodySchema,
    },
  }, async (request, reply) => {
    requireOrgId(request);
    const messages = parseMessages(request.body);
    const conversation = formatConversation(messages);
    const { systemPrompt, websiteEnriched, websiteImageUrl } =
      await buildSummarySystemPrompt(messages);
    const raw = await callGroq(
      systemPrompt,
      [{ role: "user", content: conversation }],
      400,
      { jsonObject: true },
    );
    const summary = {
      ...parseSummaryResponse(raw),
      websiteEnriched,
      websiteImageUrl,
    };

    return reply.send(summary);
  });

  r.post("/discovery/complete", {
    schema: {
      ...authenticatedRoute("Discovery", "Persist discovery summary into Strategy"),
      body: DiscoveryCompleteBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { summary, messages } = request.body as {
      summary: DiscoverySummary;
      messages: IncomingMessage[];
    };

    parseMessages({ messages });

    const strategyData = {
      icpDefinition: {
        idealCustomer: summary.idealCustomer ?? "",
      } as Prisma.InputJsonValue,
      positioning: {
        businessModel: summary.businessModel ?? "",
        industry: summary.industry ?? "",
        strengths: summary.strengths ?? "",
      } as Prisma.InputJsonValue,
      channels: {
        suggestedChannels: summary.suggestedChannels ?? [],
      } as Prisma.InputJsonValue,
      messagingAngles: {} as Prisma.InputJsonValue,
      creativeAssets: {} as Prisma.InputJsonValue,
      executionPlan: [] as Prisma.InputJsonValue,
      completedSteps: [0],
    };

    const existing = await prisma.strategy.findFirst({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
    });

    const strategy = existing
      ? await prisma.strategy.update({
          where: { id: existing.id },
          data: strategyData,
        })
      : await prisma.strategy.create({
          data: {
            orgId,
            ...strategyData,
          },
        });

    return reply.send({ strategyId: strategy.id });
  });
}

export async function anonymousDiscoveryRoutes(
  app: FastifyInstance,
): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/discovery/scrape/anonymous",
    {
      config: {
        rateLimit: {
          // Keep public production traffic tightly bounded while allowing
          // local E2E/manual verification to repeat without locking the form.
          max: process.env.NODE_ENV === "production" ? 3 : 100,
          timeWindow: "10 minutes",
        },
      },
      schema: {
        ...publicRoute("Discovery", "Anonymous website discovery scrape (pre-signup)"),
        body: AnonymousDiscoveryScrapeBodySchema,
      },
    },
    async (request, reply) => {
      const { url: rawUrl, anonId } = request.body;
      const url = normalizeScrapeUrl(rawUrl);
      const statusKey = anonScrapeStatusKey(anonId);
      const existingStatus = await getScrapeStatus(statusKey);
      if (
        existingStatus?.url === url &&
        (existingStatus.status === "running" ||
          existingStatus.status === "completed")
      ) {
        return reply.send(existingStatus);
      }
      const runningStatus = emptyScrapeStatus("running", url);

      await setScrapeStatus(
        statusKey,
        runningStatus,
        ANON_SCRAPE_STATUS_TTL_SECONDS,
      );
      void runDiscoveryScrape(
        statusKey,
        url,
        ANON_SCRAPE_STATUS_TTL_SECONDS,
        anonId,
      );

      return reply.send(runningStatus);
    },
  );

  r.get(
    "/discovery/scrape/anonymous-status",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "10 minutes",
        },
      },
      schema: {
        ...publicRoute("Discovery", "Anonymous discovery scrape status"),
        querystring: AnonymousDiscoveryScrapeStatusQuerySchema,
      },
    },
    async (request, reply) => {
      const { anonId } = request.query;
      const status = await getScrapeStatus(anonScrapeStatusKey(anonId));

      return reply.send(status ?? emptyScrapeStatus("idle", null));
    },
  );
}
