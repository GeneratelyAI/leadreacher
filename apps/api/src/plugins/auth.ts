import { createClient } from "@supabase/supabase-js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { AuthError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const BOOTSTRAP_MESSAGE =
  "Organization not set up. Call POST /auth/bootstrap first.";

// User JWTs must be verified with the anon key (apikey header). Service role is
// for admin operations only; using it here can break getUser(jwt) in some SDK versions.
const supabase = createClient(
  env.SUPABASE_URL.replace(/\/$/, ""),
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError();
  }

  request.userId = user.id;
  request.userEmail = user.email ?? undefined;
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
