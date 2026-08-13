import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "./errors.js";
import { prisma } from "./prisma.js";
import { requireOrgId } from "./request-org.js";

export async function requireOrganizationOwner(request: FastifyRequest): Promise<{
  orgId: string;
  userId: string;
}> {
  const orgId = requireOrgId(request);
  if (!request.dbUserId) throw new ForbiddenError();
  const user = await prisma.user.findFirst({
    where: { id: request.dbUserId, orgId, role: "owner" },
    select: { id: true },
  });
  if (!user) {
    throw new ForbiddenError("Only the organization owner can perform this action");
  }
  return { orgId, userId: user.id };
}
