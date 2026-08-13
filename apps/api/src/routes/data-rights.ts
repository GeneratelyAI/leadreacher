import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { R2Adapter } from "../adapters/r2.js";
import { env } from "../config/env.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { assertExportDownloadReady } from "../lib/export-download.js";
import { authenticatedRoute } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrganizationOwner } from "../lib/organization-access.js";
import { requireMfa } from "../plugins/auth.js";
import { requireOrgId } from "../lib/request-org.js";
import { requestOrganizationDeletion } from "../services/organization-lifecycle.js";

export async function dataRightsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post("/dashboard/exports", {
    preHandler: [requireMfa],
    schema: {
      ...authenticatedRoute("Dashboard", "Request an organization data export"),
      body: z.object({ format: z.enum(["json", "csv"]).default("json") }),
    },
  }, async (request, reply) => {
    const { orgId, userId: requestedById } = await requireOrganizationOwner(request);
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
    preHandler: [requireMfa],
    schema: authenticatedRoute("Dashboard", "List organization data exports"),
  }, async (request, reply) => {
    const { orgId } = await requireOrganizationOwner(request);
    const jobs = await prisma.organizationExportJob.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return reply.send({ exports: jobs });
  });

  r.get("/dashboard/exports/:exportId/download", {
    preHandler: [requireMfa],
    schema: {
      ...authenticatedRoute("Dashboard", "Create a short-lived export download URL"),
      params: z.object({ exportId: z.string().min(1) }),
    },
  }, async (request, reply) => {
    const { orgId } = await requireOrganizationOwner(request);
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
    preHandler: [requireMfa],
    schema: {
      ...authenticatedRoute("Dashboard", "Schedule recoverable organization deletion"),
      body: z.object({ confirmation: z.string().min(1) }),
    },
  }, async (request, reply) => {
    const { orgId } = await requireOrganizationOwner(request);
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!organization) throw new NotFoundError("Organization");
    if (request.body.confirmation !== organization.name) {
      throw new ValidationError("Enter the organization name exactly to confirm deletion");
    }
    const purgeAt = await requestOrganizationDeletion(orgId);
    return reply.send({ scheduled: true, purgeAt });
  });
}
