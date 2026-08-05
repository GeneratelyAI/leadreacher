import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { R2Adapter } from "../adapters/r2.js";
import { env } from "../config/env.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { assertExportDownloadReady } from "../lib/export-download.js";
import { authenticatedRoute } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { requestOrganizationDeletion } from "../services/organization-lifecycle.js";

async function requireOwner(userId: string | undefined, orgId: string): Promise<string> {
  if (!userId) throw new ForbiddenError();
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId, role: "owner" },
    select: { id: true },
  });
  if (!user) throw new ForbiddenError("Only the organization owner can perform this action");
  return user.id;
}

export async function dataRightsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post("/dashboard/exports", {
    schema: {
      ...authenticatedRoute("Dashboard", "Request an organization data export"),
      body: z.object({ format: z.enum(["json", "csv"]).default("json") }),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const requestedById = await requireOwner(request.dbUserId, orgId);
    const existing = await prisma.organizationExportJob.findFirst({
      where: { orgId, status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "desc" },
    });
    const job = existing ?? await prisma.organizationExportJob.create({
      data: { orgId, requestedById, format: request.body.format },
    });
    return reply.status(existing ? 200 : 202).send(job);
  });

  r.get("/dashboard/exports", {
    schema: authenticatedRoute("Dashboard", "List organization data exports"),
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    await requireOwner(request.dbUserId, orgId);
    const jobs = await prisma.organizationExportJob.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return reply.send({ exports: jobs });
  });

  r.get("/dashboard/exports/:exportId/download", {
    schema: {
      ...authenticatedRoute("Dashboard", "Create a short-lived export download URL"),
      params: z.object({ exportId: z.string().min(1) }),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    await requireOwner(request.dbUserId, orgId);
    const job = await prisma.organizationExportJob.findFirst({
      where: { id: request.params.exportId, orgId },
    });
    if (!job) throw new NotFoundError("Export");
    assertExportDownloadReady(job);
    const expiresIn = Math.max(60, Math.min(3600, Math.floor((job.expiresAt.getTime() - Date.now()) / 1000)));
    const url = await new R2Adapter().createSignedDownloadUrl(job.objectKey, expiresIn);
    return reply.send({ url, expiresAt: new Date(Date.now() + expiresIn * 1000) });
  });

  r.post("/dashboard/legal/accept", {
    schema: authenticatedRoute("Dashboard", "Accept current privacy and terms versions"),
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: {
        legalAcceptedAt: new Date(),
        termsVersion: env.TERMS_VERSION,
        privacyVersion: env.PRIVACY_VERSION,
      },
      select: { legalAcceptedAt: true, termsVersion: true, privacyVersion: true },
    });
    return reply.send(organization);
  });

  r.post("/dashboard/organization/deletion", {
    schema: {
      ...authenticatedRoute("Dashboard", "Schedule recoverable organization deletion"),
      body: z.object({ confirmation: z.string().min(1) }),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    await requireOwner(request.dbUserId, orgId);
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!organization) throw new NotFoundError("Organization");
    if (request.body.confirmation !== organization.name) {
      throw new ValidationError("Enter the organization name exactly to confirm deletion");
    }
    const purgeAt = await requestOrganizationDeletion(orgId);
    return reply.send({ scheduled: true, purgeAt });
  });
}
