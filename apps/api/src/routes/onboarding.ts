import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";

const CompleteOnboardingResponseSchema = z.object({
  completed: z.literal(true),
});

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/onboarding/complete",
    {
      schema: {
        ...authenticatedRoute("Onboarding", "Mark onboarding complete"),
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { subscriptionStatus: true, onboardedAt: true },
      });

      if (!organization || organization.subscriptionStatus !== "active") {
        throw new ForbiddenError("An active subscription is required to complete onboarding");
      }

      const connectedAccountCount = await prisma.socialAccount.count({
        where: { orgId, status: "active" },
      });
      if (connectedAccountCount < 1) {
        throw new ValidationError(
          "Connect at least one active channel before completing onboarding",
        );
      }

      if (!organization.onboardedAt) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardedAt: new Date() },
        });
      }

      return reply.send({ completed: true as const });
    },
  );
}
