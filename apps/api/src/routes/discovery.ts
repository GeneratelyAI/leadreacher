import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { callGroq } from "../lib/groq.js";
import {
  extractWebsiteUrlFromText,
} from "../lib/firecrawl.js";
import { enrichFromUrl } from "../lib/link-enricher.js";
import { fetchWebsitePreviewImage } from "../lib/website-text.js";
import { ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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

All values must use formal, professional business language in complete sentences or polished phrases. Every string must begin with a capital letter. Use sentence case throughout — never Title Case or ALL CAPS. End full-sentence fields with proper punctuation.

Field guidance:
- businessModel: what the business sells or does (from the first user answer); one concise formal phrase
- industry: return a specific descriptor like 'B2B SaaS / sales technology' or 'Fintech / payments infrastructure', not just 'SaaS' or 'tech'. Be specific. (from the first user answer)
- strengths: differentiators (from the second user answer); one concise formal phrase
- idealCustomer: ICP — title, company size, location (from the third user answer); one concise formal phrase
- suggestedChannels: best outreach channels for their goal (from the fourth user answer); values must be from ["linkedin","whatsapp","instagram","facebook","email"]
- nextStep: Write one formal, concrete forward-looking action sentence based on the business, ICP, and suggested channels. Example: 'Launch a LinkedIn sequence targeting RevOps leaders at B2B SaaS companies, leading with your unified data enrichment advantage.' Only populate this once suggestedChannels is non-empty, otherwise return empty string.

If a field cannot be inferred yet, return an empty string or empty array for suggestedChannels.`;

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
  app.post("/discovery/summary", async (request, reply) => {
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

  app.post("/discovery/complete", async (request, reply) => {
    const orgId = requireOrgId(request);

    if (
      !request.body ||
      typeof request.body !== "object" ||
      !("summary" in request.body) ||
      !("messages" in request.body)
    ) {
      throw new ValidationError("summary and messages are required");
    }

    const { summary, messages } = request.body as {
      summary: DiscoverySummary;
      messages: IncomingMessage[];
    };

    if (!summary || typeof summary !== "object") {
      throw new ValidationError("summary is required");
    }

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
