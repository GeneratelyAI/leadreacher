import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApifyAdapter } from "../adapters/apify.js";
import { env } from "../config/env.js";
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
  importScrapedProfiles,
} from "../services/lead-import.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const ScrapeLeadsFiltersSchema = z.object({
  jobTitles: z.array(z.string()),
  industries: z.array(z.string()),
  companySizes: z.array(z.string()),
  locations: z.array(z.string()),
  keywords: z.array(z.string()).optional(),
});

const ScrapeLeadsBodySchema = z.object({
  filters: ScrapeLeadsFiltersSchema,
  maxResults: z.number().int().positive().max(MAX_LIMIT).optional(),
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

  r.post(
    "/leads/scrape",
    {
      schema: {
        ...authenticatedRoute("Leads", "Scrape LinkedIn leads via Apify"),
        body: ScrapeLeadsBodySchema,
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const { filters, maxResults } = request.body;

      const adapter = new ApifyAdapter({ apiKey: env.APIFY_API_KEY });
      const profiles = await adapter.scrapeLeads(filters, maxResults ?? 100);
      const { imported, skipped } = await importScrapedProfiles(orgId, profiles);

      return reply.send({
        imported,
        skipped,
        total: profiles.length,
      });
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
