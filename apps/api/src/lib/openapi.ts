import { z } from "zod";

/** OpenAPI tag names — keep in sync with @fastify/swagger registration. */
export const OPENAPI_TAGS = [
  "Health",
  "Auth",
  "Webhooks",
  "Leads",
  "Campaigns",
  "Discovery",
  "Strategy",
  "Billing",
  "SocialAccounts",
  "Onboarding",
  "Dashboard",
] as const;

export type OpenApiTag = (typeof OPENAPI_TAGS)[number];

export const ErrorResponseSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .meta({ id: "ErrorResponse" });

export const RateLimitErrorSchema = z
  .object({
    statusCode: z.literal(429),
    error: z.literal("RATE_LIMITED"),
    message: z.string(),
  })
  .meta({ id: "RateLimitError" });

/**
 * Prefer omitting success `response` schemas for complex payloads — `z.any()` /
 * `z.unknown()` do not compile to valid AJV schemas with Fastify.
 * Keep request schemas + error responses instead.
 */
export const errorResponses = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  413: ErrorResponseSchema,
  429: RateLimitErrorSchema,
  500: ErrorResponseSchema,
} as const;

export const bearerSecurity = [{ bearerAuth: [] }] as const;
export const unipileSecurity = [{ unipileAuth: [] }] as const;
export const stripeSecurity = [{ stripeSignature: [] }] as const;

export function authenticatedRoute(tag: OpenApiTag, summary: string, description?: string) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    security: [...bearerSecurity],
  };
}

export function publicRoute(tag: OpenApiTag, summary: string, description?: string) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
  };
}

export const IdParamsSchema = z.object({
  id: z.string().min(1),
});

export const CampaignIdParamsSchema = z.object({
  campaignId: z.string().min(1),
});

export const LeadIdParamsSchema = z.object({
  leadId: z.string().min(1),
});

export const CampaignLeadIdParamsSchema = z.object({
  campaignLeadId: z.string().min(1),
});
