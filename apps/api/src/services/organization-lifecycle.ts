import { createClient } from "@supabase/supabase-js";
import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { R2Adapter } from "../adapters/r2.js";
import { prisma } from "../lib/prisma.js";
import { cancelSubscriptionAtPeriodEnd, restoreSubscriptionRenewal } from "../lib/stripe.js";
import {
  cancelCampaignPendingSequenceJobs,
  resumeCampaignSequenceJobs,
} from "./campaign-sequence-control.js";
import { getOrganizationEntitlement } from "./entitlements.js";
import { enqueueOrganizationEmail } from "./product-email-outbox.js";

const RECOVERY_DAYS = 30;

export async function requestOrganizationDeletion(orgId: string): Promise<Date> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { stripeSubscriptionId: true },
  });
  const now = new Date();
  const purgeAt = new Date(now.getTime() + RECOVERY_DAYS * 24 * 60 * 60 * 1000);
  const campaigns = await prisma.campaign.findMany({
    where: { orgId, status: "active" },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { disabledAt: now, deletionRequestedAt: now, purgeAt },
    }),
    prisma.campaign.updateMany({
      where: { orgId, status: "active" },
      data: { status: "paused", suspensionReason: "deletion" },
    }),
  ]);
  await Promise.all(
    campaigns.map((campaign) =>
      cancelCampaignPendingSequenceJobs({ campaignId: campaign.id, orgId }),
    ),
  );
  if (organization.stripeSubscriptionId) {
    await cancelSubscriptionAtPeriodEnd(organization.stripeSubscriptionId);
  }
  await enqueueOrganizationEmail({
    orgId,
    idempotencyKey: `organization-deletion:${orgId}:${purgeAt.toISOString()}`,
    template: "organization_deletion_scheduled",
    subject: "Your LeadReacher workspace is scheduled for deletion",
    text: `Your workspace has been disabled and is scheduled for permanent deletion on ${purgeAt.toISOString()}. Sign in before then to recover it.`,
  });
  return purgeAt;
}

export async function recoverOrganization(orgId: string): Promise<void> {
  const [entitlement, organization, suspended] = await Promise.all([
    getOrganizationEntitlement(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { stripeSubscriptionId: true } }),
    prisma.campaign.findMany({
      where: { orgId, status: "paused", suspensionReason: "deletion" },
      select: { id: true },
    }),
  ]);
  if (entitlement.entitled && organization?.stripeSubscriptionId) {
    await restoreSubscriptionRenewal(organization.stripeSubscriptionId);
  }
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { disabledAt: null, deletionRequestedAt: null, purgeAt: null },
    }),
    prisma.campaign.updateMany({
      where: { orgId, status: "paused", suspensionReason: "deletion" },
      data: entitlement.entitled
        ? { status: "active", suspensionReason: null }
        : { suspensionReason: "billing" },
    }),
  ]);
  if (entitlement.entitled) {
    await Promise.all(
      suspended.map((campaign) =>
        resumeCampaignSequenceJobs({ campaignId: campaign.id, orgId }),
      ),
    );
  }
}

function r2KeyFromUrl(url: string | null): string | null {
  if (!url || !env.R2_PUBLIC_URL) return null;
  const prefix = `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

function uploadedStrategyVideoUrl(videoConfig: Prisma.JsonValue): string | null {
  if (!videoConfig || typeof videoConfig !== "object" || Array.isArray(videoConfig)) return null;
  const url = videoConfig.uploadedVideoUrl;
  return typeof url === "string" ? url : null;
}

export async function purgeExpiredOrganizations(limit = 5): Promise<{ purged: number }> {
  const organizations = await prisma.organization.findMany({
    where: { purgeAt: { lte: new Date() }, disabledAt: { not: null } },
    orderBy: { purgeAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const r2 = new R2Adapter();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let purged = 0;

  for (const organization of organizations) {
    const [users, videos, templates, strategies, exports] = await Promise.all([
      prisma.user.findMany({ where: { orgId: organization.id }, select: { supabaseId: true } }),
      prisma.videoAsset.findMany({
        where: { orgId: organization.id },
        select: { videoUrl: true, thumbnailUrl: true, seedImageUrl: true },
      }),
      prisma.campaignVideoTemplate.findMany({
        where: { orgId: organization.id },
        select: { seedImageUrl: true, masterVideoUrl: true, sharedNarrationUrl: true },
      }),
      prisma.strategy.findMany({
        where: { orgId: organization.id },
        select: { videoConfig: true },
      }),
      prisma.organizationExportJob.findMany({ where: { orgId: organization.id }, select: { objectKey: true } }),
    ]);
    const objectKeys = new Set(
      [
        ...videos.flatMap((video) => [video.videoUrl, video.thumbnailUrl, video.seedImageUrl]),
        ...templates.flatMap((template) => [template.seedImageUrl, template.masterVideoUrl, template.sharedNarrationUrl]),
        ...strategies.map((strategy) => uploadedStrategyVideoUrl(strategy.videoConfig)),
      ]
        .map(r2KeyFromUrl)
        .concat(exports.map((job) => job.objectKey))
        .filter((key): key is string => Boolean(key)),
    );
    await Promise.all(Array.from(objectKeys, (key) => r2.deleteObject(key)));

    await prisma.$transaction(async (tx) => {
      const campaigns = await tx.campaign.findMany({ where: { orgId: organization.id }, select: { id: true } });
      const campaignIds = campaigns.map((campaign) => campaign.id);
      await tx.message.deleteMany({ where: { orgId: organization.id } });
      await tx.videoAsset.deleteMany({ where: { orgId: organization.id } });
      await tx.campaignVideoTemplate.deleteMany({ where: { orgId: organization.id } });
      await tx.campaignLead.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.campaignChannelAccount.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.campaign.deleteMany({ where: { orgId: organization.id } });
      await tx.auditLog.deleteMany({ where: { orgId: organization.id } });
      await tx.pipelineRun.deleteMany({ where: { orgId: organization.id } });
      await tx.lead.deleteMany({ where: { orgId: organization.id } });
      await tx.strategy.deleteMany({ where: { orgId: organization.id } });
      await tx.socialAccount.deleteMany({ where: { orgId: organization.id } });
      await tx.integration.deleteMany({ where: { orgId: organization.id } });
      await tx.user.deleteMany({ where: { orgId: organization.id } });
      await tx.organization.delete({ where: { id: organization.id } });
    });
    await Promise.all(users.map((user) => supabase.auth.admin.deleteUser(user.supabaseId)));
    purged += 1;
  }
  return { purged };
}
