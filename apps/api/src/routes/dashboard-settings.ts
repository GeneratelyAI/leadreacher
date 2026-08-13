import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticatedRoute } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { resolvePlanDisplayLabel } from "../lib/billing/pricing.js";

const UpdateDashboardSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
});

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export async function registerDashboardSettingsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/dashboard/settings", {
    schema: authenticatedRoute("Dashboard", "Get organization settings"),
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const [organization, members] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          stripeCustomerId: true,
        },
      }),
      prisma.user.findMany({
        where: { orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: memberSelect,
      }),
    ]);

    return reply.send({
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            plan: resolvePlanDisplayLabel(organization.plan),
            subscriptionStatus: organization.subscriptionStatus,
            currentPeriodEnd: organization.currentPeriodEnd,
            hasBillingPortal: Boolean(organization.stripeCustomerId),
          }
        : null,
      members,
    });
  });

  r.patch("/dashboard/settings", {
    schema: {
      ...authenticatedRoute("Dashboard", "Update organization settings"),
      body: UpdateDashboardSettingsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { organizationName } = request.body;
    const [organization, members] = await Promise.all([
      prisma.organization.update({
        where: { id: orgId },
        data: { name: organizationName },
        select: { id: true, name: true, plan: true, subscriptionStatus: true, currentPeriodEnd: true, stripeCustomerId: true },
      }),
      prisma.user.findMany({
        where: { orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: memberSelect,
      }),
    ]);
    return reply.send({
      organization: {
        id: organization.id,
        name: organization.name,
        plan: resolvePlanDisplayLabel(organization.plan),
        subscriptionStatus: organization.subscriptionStatus,
        currentPeriodEnd: organization.currentPeriodEnd,
        hasBillingPortal: Boolean(organization.stripeCustomerId),
      },
      members,
    });
  });
}
