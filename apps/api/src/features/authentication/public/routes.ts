import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthError, ValidationError } from "../../../platform/http/errors.js";
import { bearerSecurity } from "../../../platform/http/openapi.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { requireMfa, verifySupabaseJwt } from "../../../platform/auth/hooks.js";
import { recoverOrganization } from "../../organizations/public/lifecycle.js";
import { bootstrapUserOrganization } from "../services/bootstrap.js";

export { claimCompletedAnonymousScrape } from "../services/bootstrap.js";

const BootstrapBodySchema = z.object({
  name: z.string().trim().min(1),
  accountType: z.enum(["individual", "company"]).optional().default("individual"),
  anonScrapeId: z.string().uuid().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/auth/organization/recover",
    {
      preHandler: [verifySupabaseJwt, requireMfa],
      schema: {
        tags: ["Auth"],
        summary: "Recover an organization pending deletion",
        security: [...bearerSecurity],
      },
    },
    async (request, reply) => {
      if (!request.userId) throw new AuthError();
      const user = await prisma.user.findUnique({
        where: { supabaseId: request.userId },
        select: { orgId: true, role: true, org: { select: { disabledAt: true, purgeAt: true } } },
      });
      if (!user?.orgId || user.role !== "owner") throw new AuthError();
      if (!user.org?.disabledAt || !user.org.purgeAt || user.org.purgeAt <= new Date()) {
        throw new ValidationError("This organization is not recoverable");
      }
      await recoverOrganization(user.orgId);
      return reply.send({ recovered: true });
    },
  );

  r.post(
    "/auth/bootstrap",
    {
      preHandler: [verifySupabaseJwt],
      schema: {
        tags: ["Auth"],
        summary: "Bootstrap user and organization from Supabase JWT",
        security: [...bearerSecurity],
        body: BootstrapBodySchema,
      },
    },
    async (request, reply) => {
      return reply.send(await bootstrapUserOrganization({
        ...request.body,
        supabaseId: request.userId,
        email: request.userEmail,
      }));
    },
  );
}
