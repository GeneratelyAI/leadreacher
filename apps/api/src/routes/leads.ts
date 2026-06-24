import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApifyAdapter } from "../adapters/apify.js";
import { env } from "../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { LeadStatusSchema } from "../lib/lead-status.js";
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
  maxResults: z.number().int().positive().optional(),
});

const PatchLeadBodySchema = z
  .object({
    status: LeadStatusSchema.optional(),
  })
  .refine((body) => body.status !== undefined, {
    message: "At least one updatable field is required",
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
  })
  .strict();

const ImportCsvBodySchema = z.object({
  rows: z
    .array(CsvRowSchema)
    .min(1, "rows must be a non-empty array"),
});

function parseLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseOffset(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export async function leadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/leads/scrape", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { filters, maxResults } = ScrapeLeadsBodySchema.parse(request.body);

    const adapter = new ApifyAdapter({ apiKey: env.APIFY_API_KEY });
    const profiles = await adapter.scrapeLeads(filters, maxResults ?? 100);
    const { imported, skipped } = await importScrapedProfiles(orgId, profiles);

    return reply.send({
      imported,
      skipped,
      total: profiles.length,
    });
  });

  app.post("/leads/import/csv", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { rows } = ImportCsvBodySchema.parse(request.body);

    const { imported, skipped } = await importFromCSV(orgId, rows);

    return reply.send({
      imported,
      skipped,
      total: rows.length,
    });
  });

  app.get("/leads", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { status, source, limit, offset } = request.query as {
      status?: string;
      source?: string;
      limit?: number;
      offset?: number;
    };

    const parsedLimit = parseLimit(limit);
    const parsedOffset = parseOffset(offset);

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
  });

  app.patch("/leads/:id", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { id } = request.params as { id: string };
    const body = PatchLeadBodySchema.parse(request.body);

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundError("Lead");
    if (lead.orgId !== orgId) throw new ForbiddenError();

    const updated = await prisma.lead.update({
      where: { id },
      data: body,
    });

    return reply.send(updated);
  });

  app.delete("/leads/:id", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { id } = request.params as { id: string };

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

    return reply.send({ deleted: true, id });
  });
}
