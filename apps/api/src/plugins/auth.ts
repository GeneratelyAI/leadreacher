import { createClient } from "@supabase/supabase-js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import {
  AuthError,
  ForbiddenError,
  MfaRequiredError,
  OrganizationDisabledError,
  UnauthorizedError,
} from "../lib/errors.js";
import { authenticationAssuranceLevel } from "../lib/auth-assurance.js";
import { prisma } from "../lib/prisma.js";

const BOOTSTRAP_MESSAGE =
  "Organization not set up. Call POST /auth/bootstrap first.";

// User JWTs must be verified with the anon key (apikey header). Service role is
// for admin operations only; using it here can break getUser(jwt) in some SDK versions.
let supabase: ReturnType<typeof createClient> | undefined;

function getSupabaseClient() {
  supabase ??= createClient(
    env.SUPABASE_URL.replace(/\/$/, ""),
    env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return supabase;
}

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
  } = await getSupabaseClient().auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError();
  }

  request.userId = user.id;
  request.userEmail = user.email ?? undefined;
  request.authAal = authenticationAssuranceLevel(token);
}

export async function requireMfa(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (request.authAal !== "aal2") throw new MfaRequiredError();
}

/** Require MFA after initial onboarding so new workspaces can connect a sender. */
export async function requireMfaForEstablishedOrganization(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.orgId) throw new AuthError();
  const organization = await prisma.organization.findUnique({
    where: { id: request.orgId },
    select: { onboardedAt: true },
  });
  if (organization?.onboardedAt) await requireMfa(request, reply);
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
    select: { id: true, orgId: true, org: { select: { disabledAt: true } } },
  });

  if (!user?.orgId) {
    throw new ForbiddenError(BOOTSTRAP_MESSAGE);
  }
  if (user.org?.disabledAt) throw new OrganizationDisabledError();

  request.dbUserId = user.id;
  request.orgId = user.orgId;
}
