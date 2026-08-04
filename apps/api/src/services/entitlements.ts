import type { PrismaClient } from "@prisma/client";
import { SubscriptionRequiredError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import {
  cancelCampaignPendingSequenceJobs,
  resumeCampaignSequenceJobs,
} from "./campaign-sequence-control.js";

export type SubscriptionEntitlement = {
  entitled: boolean;
  currentPeriodEnd: Date | null;
  status: string | null;
};

export function subscriptionIsEntitled(
  input: { subscriptionStatus: string | null; currentPeriodEnd: Date | null },
  now = new Date(),
): boolean {
  if (input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing") {
    return true;
  }
  return (
    input.subscriptionStatus === "canceled" &&
    input.currentPeriodEnd !== null &&
    input.currentPeriodEnd.getTime() > now.getTime()
  );
}

export async function getOrganizationEntitlement(
  orgId: string,
  client: Pick<PrismaClient, "organization"> = prisma,
): Promise<SubscriptionEntitlement> {
  const organization = await client.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, currentPeriodEnd: true },
  });
  const status = organization?.subscriptionStatus ?? null;
  const currentPeriodEnd = organization?.currentPeriodEnd ?? null;
  return {
    entitled: subscriptionIsEntitled({ subscriptionStatus: status, currentPeriodEnd }),
    currentPeriodEnd,
    status,
  };
}

export async function requireOrganizationEntitlement(orgId: string): Promise<void> {
  const entitlement = await getOrganizationEntitlement(orgId);
  if (!entitlement.entitled) throw new SubscriptionRequiredError();
}

export async function synchronizeBillingSuspension(orgId: string): Promise<void> {
  const entitlement = await getOrganizationEntitlement(orgId);
  if (!entitlement.entitled) {
    const activeCampaigns = await prisma.campaign.findMany({
      where: { orgId, status: "active" },
      select: { id: true },
    });
    if (!activeCampaigns.length) return;
    await prisma.campaign.updateMany({
      where: { id: { in: activeCampaigns.map((campaign) => campaign.id) }, orgId },
      data: { status: "paused", suspensionReason: "billing" },
    });
    await Promise.all(
      activeCampaigns.map((campaign) =>
        cancelCampaignPendingSequenceJobs({ campaignId: campaign.id, orgId }),
      ),
    );
    return;
  }

  const billingSuspended = await prisma.campaign.findMany({
    where: { orgId, status: "paused", suspensionReason: "billing" },
    select: { id: true },
  });
  if (!billingSuspended.length) return;
  await prisma.campaign.updateMany({
    where: { id: { in: billingSuspended.map((campaign) => campaign.id) }, orgId },
    data: { status: "active", suspensionReason: null },
  });
  await Promise.all(
    billingSuspended.map((campaign) =>
      resumeCampaignSequenceJobs({ campaignId: campaign.id, orgId }),
    ),
  );
}
