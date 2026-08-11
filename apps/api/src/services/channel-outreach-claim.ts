import { Prisma } from "@prisma/client";
import type { OutreachChannel } from "../lib/channels.js";
import { prisma } from "../lib/prisma.js";

export async function claimFirstChannelOutreach(input: {
  orgId: string;
  leadId: string;
  campaignId: string;
  channel: OutreachChannel;
}): Promise<{ acquired: boolean; campaignId: string }> {
  try {
    const claim = await prisma.channelOutreachClaim.create({ data: input, select: { campaignId: true } });
    return { acquired: true, campaignId: claim.campaignId };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await prisma.channelOutreachClaim.findUnique({
      where: { orgId_leadId_channel: { orgId: input.orgId, leadId: input.leadId, channel: input.channel } },
      select: { campaignId: true },
    });
    return { acquired: existing?.campaignId === input.campaignId, campaignId: existing?.campaignId ?? "unknown" };
  }
}
