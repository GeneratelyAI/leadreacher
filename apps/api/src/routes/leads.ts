import type { FastifyInstance } from "fastify";
import { ApifyAdapter, type ICPFilters } from "../adapters/apify.js";
import { env } from "../config/env.js";
import { ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import {
  type CSVRow,
  importFromCSV,
  importScrapedProfiles,
} from "../services/lead-import.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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
    const { orgId, filters, maxResults } = request.body as {
      orgId: string;
      filters: ICPFilters;
      maxResults?: number;
    };

    if (!orgId) throw new ValidationError("orgId is required");
    if (!filters) throw new ValidationError("filters is required");

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
    const { orgId, rows } = request.body as {
      orgId: string;
      rows: CSVRow[];
    };

    if (!orgId) throw new ValidationError("orgId is required");
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new ValidationError("rows must be a non-empty array");
    }

    const { imported, skipped } = await importFromCSV(orgId, rows);

    return reply.send({
      imported,
      skipped,
      total: rows.length,
    });
  });

  app.get("/leads", async (request, reply) => {
    const { orgId, status, source, limit, offset } = request.query as {
      orgId: string;
      status?: string;
      source?: string;
      limit?: number;
      offset?: number;
    };

    if (!orgId) throw new ValidationError("orgId is required");

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
}
