import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  anonScrapeClaimKey,
  anonScrapeStatusKey,
  ANON_SCRAPE_STATUS_TTL_SECONDS,
  getScrapeStatus,
  orgScrapeStatusKey,
  SCRAPE_STATUS_TTL_SECONDS,
  setScrapeStatus,
  type DiscoveryScrapeStatus,
} from "./discovery.js";
import { AuthError, ValidationError } from "../lib/errors.js";
import { bearerSecurity, errorResponses } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { verifySupabaseJwt } from "../plugins/auth.js";

const BootstrapBodySchema = z.object({
  name: z.string().trim().min(1),
  accountType: z.enum(["individual", "company"]).optional().default("individual"),
  anonScrapeId: z.string().uuid().optional(),
});

type ScrapeStatusStorage = {
  getStatus: (statusKey: string) => Promise<DiscoveryScrapeStatus | null>;
  setStatus: (
    statusKey: string,
    status: DiscoveryScrapeStatus,
    ttlSeconds: number,
  ) => Promise<void>;
  deleteStatus: (statusKey: string) => Promise<unknown>;
  setClaim?: (anonScrapeId: string, orgId: string) => Promise<void>;
  deleteClaim?: (anonScrapeId: string) => Promise<unknown>;
};

const redisScrapeStatusStorage: ScrapeStatusStorage = {
  getStatus: getScrapeStatus,
  setStatus: setScrapeStatus,
  deleteStatus: (statusKey) => redis.del(statusKey),
  setClaim: async (anonScrapeId, orgId) => {
    await redis.set(
      anonScrapeClaimKey(anonScrapeId),
      orgId,
      "EX",
      ANON_SCRAPE_STATUS_TTL_SECONDS,
    );
  },
  deleteClaim: (anonScrapeId) => redis.del(anonScrapeClaimKey(anonScrapeId)),
};

async function getOrganizationOnboardingProgress(orgId: string): Promise<{
  subscriptionStatus: string | null;
  onboardedAt: Date | null;
  activeChannelCount: number;
}> {
  const [organization, activeChannelCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionStatus: true, onboardedAt: true },
    }),
    prisma.socialAccount.count({
      where: { orgId, status: "active" },
    }),
  ]);

  return {
    subscriptionStatus: organization?.subscriptionStatus ?? null,
    onboardedAt: organization?.onboardedAt ?? null,
    activeChannelCount,
  };
}

export async function claimCompletedAnonymousScrape(
  input: { orgId: string; anonScrapeId?: string },
  storage: ScrapeStatusStorage = redisScrapeStatusStorage,
): Promise<DiscoveryScrapeStatus | null> {
  if (!input.anonScrapeId) {
    return null;
  }

  try {
    const anonymousKey = anonScrapeStatusKey(input.anonScrapeId);
    const anonymousStatus = await storage.getStatus(anonymousKey);
    if (!anonymousStatus) {
      return null;
    }

    await storage.setStatus(
      orgScrapeStatusKey(input.orgId),
      anonymousStatus,
      SCRAPE_STATUS_TTL_SECONDS,
    );
    if (anonymousStatus.status === "running") {
      await storage.setClaim?.(input.anonScrapeId, input.orgId);
    } else {
      await storage.deleteStatus(anonymousKey);
      await storage.deleteClaim?.(input.anonScrapeId);
    }
    return anonymousStatus;
  } catch {
    // Anonymous pre-signup data is optional and must never prevent bootstrap.
    return null;
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

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
      const { name, accountType, anonScrapeId } = request.body;
      const supabaseId = request.userId;
      if (!supabaseId) {
        throw new AuthError();
      }

      const existing = await prisma.user.findUnique({
        where: { supabaseId },
        select: { id: true, orgId: true },
      });

      if (existing?.orgId) {
        const [scrapeStatus, onboardingProgress] = await Promise.all([
          claimCompletedAnonymousScrape({
            orgId: existing.orgId,
            anonScrapeId,
          }),
          getOrganizationOnboardingProgress(existing.orgId),
        ]);
        return reply.send({
          orgId: existing.orgId,
          userId: existing.id,
          scrapeStatus,
          ...onboardingProgress,
        });
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
            accountType,
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

      const [scrapeStatus, onboardingProgress] = await Promise.all([
        claimCompletedAnonymousScrape({
          orgId: result.orgId,
          anonScrapeId,
        }),
        getOrganizationOnboardingProgress(result.orgId),
      ]);

      return reply.send({ ...result, scrapeStatus, ...onboardingProgress });
    },
  );
}
