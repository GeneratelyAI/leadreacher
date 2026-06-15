import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { AuthError, ForbiddenError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const BOOTSTRAP_MESSAGE =
  "Organization not set up. Call POST /auth/bootstrap first.";

const supabaseJwks = createRemoteJWKSet(
  new URL(
    `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`,
  ),
);

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function verifySupabaseJwt(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    throw new AuthError("Missing or invalid Authorization header");
  }

  try {
    const { payload } = await jwtVerify(token, supabaseJwks);

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AuthError("Invalid token: missing sub claim");
    }

    request.userId = payload.sub;
    request.userEmail =
      typeof payload.email === "string" ? payload.email : undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError("Invalid or expired token");
  }
}

export async function requireOrg(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.userId) {
    throw new AuthError();
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: request.userId },
    select: { id: true, orgId: true },
  });

  if (!user?.orgId) {
    throw new ForbiddenError(BOOTSTRAP_MESSAGE);
  }

  request.dbUserId = user.id;
  request.orgId = user.orgId;
}
