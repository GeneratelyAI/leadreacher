import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { LeadStatusSchema } from "../lib/lead-status.js";
import {
  ErrorResponseSchema,
  IdParamsSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import {
  importFromCSV,
  importProspectProfiles,
} from "../services/lead-import.js";
import { searchAndImportLinkedInProspects, searchLinkedInProspects } from "../services/prospect-search.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_SEARCH_RESULTS = 50;

const ScrapeLeadsFiltersSchema = z.object({
  jobTitles: z.array(z.string()),
  industries: z.array(z.string()),
  companySizes: z.array(z.string()),
  locations: z.array(z.string()),
  keywords: z.array(z.string()).optional(),
});

const ScrapeLeadsBodySchema = z
  .object({
    filters: ScrapeLeadsFiltersSchema,
    maxResults: z.number().int().positive().max(MAX_SEARCH_RESULTS).optional(),
    searchUrl: z
      .string()
      .url()
      .refine(
        (value) => value.startsWith("https://www.linkedin.com/search/results/people"),
        "searchUrl must be a LinkedIn people search URL",
      )
      .optional(),
  })
  .superRefine((value, context) => {
    const hasFilters = [
      ...value.filters.jobTitles,
      ...value.filters.industries,
      ...value.filters.companySizes,
      ...value.filters.locations,
      ...(value.filters.keywords ?? []),
    ].some((item) => item.trim().length > 0);
    if (!value.searchUrl && !hasFilters) {
      context.addIssue({
        code: "custom",
        path: ["filters"],
        message: "Add at least one search filter or a LinkedIn people search URL",
      });
    }
  });

const PatchLeadBodySchema = z.object({
  status: LeadStatusSchema,
});

const CsvRowSchema = z
  .object({
    firstName: z.string().trim().min(1, "firstName is required"),
    lastName: z.string().trim().min(1, "lastName is required"),
    linkedinUrl: z.string().optional(),
    email: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    location: z.string().optional(),
    phone: z.string().optional(),
    whatsappConsentAt: z.string().datetime({ offset: true }).optional(),
    whatsappConsentSource: z.string().trim().min(1).max(120).optional(),
    instagramUsername: z
      .string()
      .trim()
      .regex(/^@?[A-Za-z0-9._]{1,30}$/, "instagramUsername is invalid")
      .optional(),
  })
  .superRefine((row, ctx) => {
    if (row.whatsappConsentAt && !row.whatsappConsentSource) {
      ctx.addIssue({ code: "custom", path: ["whatsappConsentSource"], message: "Consent source is required with WhatsApp consent" });
    }
    if (row.whatsappConsentSource && !row.whatsappConsentAt) {
      ctx.addIssue({ code: "custom", path: ["whatsappConsentAt"], message: "Consent timestamp is required with WhatsApp consent source" });
    }
  })
  .strict();

const ImportCsvBodySchema = z.object({
  rows: z.array(CsvRowSchema).min(1, "rows must be a non-empty array"),
});

const ProspectProfileSchema = z.object({
  linkedinUrl: z.string().url().refine(
    (value) => value.startsWith("https://www.linkedin.com/in/"),
    "linkedinUrl must be a LinkedIn profile URL",
  ),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  publicIdentifier: z.string().optional(),
  providerLinkedinId: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  enrichmentData: z.record(z.string(), z.unknown()),
});

const ImportProspectProfileBodySchema = z.object({
  profile: ProspectProfileSchema,
});

const ListLeadsQuerySchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const ImportResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  total: z.number(),
});

export async function leadsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const searchRouteSchema = {
    ...authenticatedRoute("Leads", "Find LinkedIn prospects through a connected account"),
    body: ScrapeLeadsBodySchema,
  };

  r.post(
    "/prospects/search/preview",
    {
      schema: {
        ...authenticatedRoute("Leads", "Preview LinkedIn prospects through a connected account"),
        body: ScrapeLeadsBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { filters, maxResults, searchUrl } = request.body;
      const result = await searchLinkedInProspects(orgId, {
        filters,
        maxResults: maxResults ?? 10,
        searchUrl,
      });
      return reply.send(result);
    },
  );

  r.post(
    "/prospects/import",
    {
      schema: {
        ...authenticatedRoute("Leads", "Add one reviewed LinkedIn prospect"),
        body: ImportProspectProfileBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const result = await importProspectProfiles(orgId, [request.body.profile], "linkedin");
      return reply.send({
        imported: result.imported,
        skipped: result.skipped,
        leadId: result.leadIds[0] ?? null,
      });
    },
  );

  r.post(
    "/prospects/search",
    {
      schema: searchRouteSchema,
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { filters, maxResults, searchUrl } = request.body;
      const result = await searchAndImportLinkedInProspects(orgId, {
        filters,
        maxResults: maxResults ?? 25,
        searchUrl,
      });
      return reply.send(result);
    },
  );

  // Compatibility route for clients deployed before prospect search moved off Apify.
  r.post(
    "/leads/scrape",
    {
      schema: searchRouteSchema,
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { filters, maxResults, searchUrl } = request.body;
      const result = await searchAndImportLinkedInProspects(orgId, {
        filters,
        maxResults: maxResults ?? 25,
        searchUrl,
      });
      return reply.send(result);
    },
  );

  r.post(
    "/leads/import/csv",
    {
      schema: {
        ...authenticatedRoute("Leads", "Import leads from CSV rows"),
        body: ImportCsvBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { rows } = request.body;

      const { imported, skipped } = await importFromCSV(orgId, rows);

      return reply.send({
        imported,
        skipped,
        total: rows.length,
      });
    },
  );

  r.get(
    "/leads",
    {
      schema: {
        ...authenticatedRoute("Leads", "List leads for the organization"),
        querystring: ListLeadsQuerySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { status, source, limit, offset } = request.query;

      const parsedLimit = limit ?? DEFAULT_LIMIT;
      const parsedOffset = offset ?? 0;

      const where = {
        orgId,
        ...(status && { status }),
        ...(source && { source }),
      };

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          take: parsedLimit,
          skip: parsedOffset,
          orderBy: { createdAt: "desc" },
        }),
        prisma.lead.count({ where }),
      ]);

      return reply.send({
        leads,
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    },
  );

  r.patch(
    "/leads/:id",
    {
      schema: {
        ...authenticatedRoute("Leads", "Update a lead"),
        params: IdParamsSchema,
        body: PatchLeadBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { id } = request.params;
      const body = request.body;

      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundError("Lead");
      if (lead.orgId !== orgId) throw new ForbiddenError();

      const updated = await prisma.lead.update({
        where: { id },
        data: body,
      });

      return reply.send(updated);
    },
  );

  r.delete(
    "/leads/:id",
    {
      schema: {
        ...authenticatedRoute("Leads", "Delete a lead"),
        params: IdParamsSchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { id } = request.params;

      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundError("Lead");
      if (lead.orgId !== orgId) throw new ForbiddenError();

      const campaignEnrollments = await prisma.campaignLead.count({
        where: { leadId: id },
      });
      if (campaignEnrollments > 0) {
        throw new ConflictError(
          `Lead is enrolled in ${campaignEnrollments} campaign(s). Remove enrollments before deleting.`,
        );
      }

      const messageCount = await prisma.message.count({ where: { leadId: id } });
      if (messageCount > 0) {
        throw new ConflictError(
          `Lead has ${messageCount} message record(s). Cannot delete leads with campaign message history.`,
        );
      }

      await prisma.lead.delete({ where: { id } });

      return reply.send({ deleted: true as const, id });
    },
  );
}
