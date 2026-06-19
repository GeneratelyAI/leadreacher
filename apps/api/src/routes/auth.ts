import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifySupabaseJwt } from "../plugins/auth.js";

const BootstrapBodySchema = z.object({
  name: z.string().trim().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/bootstrap",
    { preHandler: [verifySupabaseJwt] },
    async (request, reply) => {
      const { name } = BootstrapBodySchema.parse(request.body);
      const supabaseId = request.userId;
      if (!supabaseId) {
        throw new AuthError();
      }

      const existing = await prisma.user.findUnique({
        where: { supabaseId },
        select: { id: true, orgId: true },
      });

      if (existing?.orgId) {
        return reply.send({ orgId: existing.orgId, userId: existing.id });
      }

      const email = request.userEmail;
      if (!email) {
        throw new ValidationError(
          "Token must include an email claim to bootstrap a new user",
        );
      }

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const org = await tx.organization.create({
          data: {
            name,
            supabaseOrgId: crypto.randomUUID(),
          },
        });

        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: { orgId: org.id },
            })
          : await tx.user.create({
              data: {
                supabaseId,
                email,
                orgId: org.id,
                role: "owner",
              },
            });

        return { orgId: org.id, userId: user.id };
      });

      return reply.send(result);
    },
  );
}
