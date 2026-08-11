import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { invalidateDashboardChrome } from "../lib/dashboard-cache.js";
import { NotFoundError } from "../lib/errors.js";
import { authenticatedRoute, LeadIdParamsSchema } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { leadSearchWhere } from "./dashboard-support.js";

const ProspectListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  reviewStatus: z.enum(["pending", "approved", "excluded"]).optional(),
  status: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  campaignId: z.string().trim().min(1).optional(),
  linkedinRelationship: z.enum(["connected", "invite_required", "unresolved", "unknown"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).superRefine((query, context) => {
  if (query.linkedinRelationship && !query.campaignId) {
    context.addIssue({
      code: "custom",
      path: ["linkedinRelationship"],
      message: "campaignId is required when filtering by LinkedIn relationship",
    });
  }
});

const ReviewProspectSchema = z.object({
  reviewStatus: z.enum(["approved", "excluded"]),
});

const BulkReviewProspectsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(100),
  reviewStatus: z.enum(["approved", "excluded"]),
});

function prospectListWhere(
  orgId: string,
  query: z.infer<typeof ProspectListQuerySchema>,
): Prisma.LeadWhereInput {
  return {
    orgId,
    ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.campaignId ? {
      campaigns: {
        some: {
          campaignId: query.campaignId,
          campaign: { orgId },
          ...(query.linkedinRelationship ? {
            linkedinRelationship: query.linkedinRelationship,
          } : {}),
        },
      },
    } : {}),
    ...(query.query ? leadSearchWhere(query.query) : {}),
  };
}

function jsonText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["message", "body", "text"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function messageContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { message: "Message content unavailable", attachments: [] };
  }
  const record = value as Record<string, unknown>;
  const rawAttachments = Array.isArray(record.attachments) ? record.attachments : [];
  const attachments = rawAttachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return [];
    const item = attachment as Record<string, unknown>;
    if (typeof item.type !== "string") return [];
    return [{
      type: item.type,
      ...(typeof item.videoUrl === "string" ? { videoUrl: item.videoUrl } : {}),
      ...(typeof item.thumbnailUrl === "string" ? { thumbnailUrl: item.thumbnailUrl } : {}),
      ...(typeof item.filename === "string" ? { filename: item.filename } : {}),
    }];
  });
  return { message: jsonText(value) || "Message content unavailable", attachments };
}

function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
}

export async function registerDashboardProspectRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/prospects", {
    schema: {
      ...authenticatedRoute("Dashboard", "List prospects for review"),
      querystring: ProspectListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const where = prospectListWhere(orgId, query);
    const [leads, total, allLeadsTotal, reviewCounts, bookedLeadsTotal, reachedLeads] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          company: true,
          location: true,
          linkedinUrl: true,
          email: true,
          phone: true,
          instagramUsername: true,
          instagramMessagingId: true,
          instagramIdentityStatus: true,
          outreachSuppressedAt: true,
          avatarUrl: true,
          source: true,
          status: true,
          reviewStatus: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          campaigns: {
            select: {
              id: true,
              status: true,
              linkedinRelationship: true,
              relationshipCheckedAt: true,
              campaign: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          messages: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.groupBy({
        by: ["reviewStatus"],
        where: { orgId },
        _count: { _all: true },
      }),
      prisma.lead.count({ where: { orgId, status: "meeting" } }),
      prisma.message.findMany({
        where: {
          orgId,
          direction: "outbound",
          status: { in: ["sent", "delivered", "opened", "replied"] },
        },
        distinct: ["leadId"],
        select: { leadId: true },
      }),
    ]);

    const counts = reviewCounts.reduce(
      (result, group) => {
        if (group.reviewStatus === "pending" || group.reviewStatus === "approved" || group.reviewStatus === "excluded") {
          result[group.reviewStatus] = group._count._all;
        }
        return result;
      },
      { pending: 0, approved: 0, excluded: 0 },
    );

    return reply.send({
      leads: leads.map((lead) => ({
        ...lead,
        lastActivityAt: lead.messages[0]?.createdAt ?? lead.updatedAt,
        campaigns: lead.campaigns.map((membership) => ({
          campaignLeadId: membership.id,
          campaignLeadStatus: membership.status,
          linkedinRelationship: membership.linkedinRelationship,
          relationshipCheckedAt: membership.relationshipCheckedAt,
          ...membership.campaign,
        })),
        messages: undefined,
      })),
      total,
      counts: {
        all: allLeadsTotal,
        pending: counts.pending,
        approved: counts.approved,
        excluded: counts.excluded,
        booked: bookedLeadsTotal,
        reached: reachedLeads.length,
      },
      limit: query.limit,
      offset: query.offset,
    });
  });

  r.get("/dashboard/prospects/:leadId", {
    schema: {
      ...authenticatedRoute("Dashboard", "Get prospect detail"),
      params: LeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        company: true,
        industry: true,
        companySize: true,
        location: true,
        linkedinUrl: true,
        email: true,
        phone: true,
        instagramUsername: true,
        instagramMessagingId: true,
        instagramIdentityStatus: true,
        outreachSuppressedAt: true,
        outreachSuppressionReason: true,
        avatarUrl: true,
        source: true,
        status: true,
        reviewStatus: true,
        reviewedAt: true,
        tags: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        campaigns: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            linkedinChatId: true,
            createdAt: true,
            campaign: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        messages: {
          select: {
            id: true,
            campaignId: true,
            direction: true,
            origin: true,
            status: true,
            content: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        videoAssets: {
          select: { id: true, status: true, videoUrl: true, thumbnailUrl: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
      },
    });
    if (!lead) throw new NotFoundError("Prospect");

    return reply.send({
      lead: {
        ...lead,
        messages: lead.messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
      },
    });
  });

  r.patch("/dashboard/prospects/:leadId/review", {
    schema: {
      ...authenticatedRoute("Dashboard", "Update prospect review status"),
      params: LeadIdParamsSchema,
      body: ReviewProspectSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params;
    const body = request.body;
    const existing = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundError("Prospect");

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
      select: { id: true, reviewStatus: true, reviewedAt: true },
    });
    await invalidateDashboardChrome(orgId);
    return reply.send({ lead });
  });

  r.post("/dashboard/prospects/review", {
    schema: {
      ...authenticatedRoute("Dashboard", "Bulk update prospect review status"),
      body: BulkReviewProspectsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const body = request.body;
    const result = await prisma.lead.updateMany({
      where: { id: { in: [...new Set(body.leadIds)] }, orgId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
    });
    await invalidateDashboardChrome(orgId);
    return reply.send({ updated: result.count, reviewStatus: body.reviewStatus });
  });

}
