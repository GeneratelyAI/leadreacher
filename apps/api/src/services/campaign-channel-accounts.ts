import { ValidationError } from "../lib/errors.js";
import {
  isOutreachChannel,
  type OutreachChannel,
  OUTREACH_CHANNELS,
} from "../lib/channels.js";
import { channelsUsedInSequence, type SequenceStep } from "../lib/sequence.js";
import { prisma } from "../lib/prisma.js";

export type ChannelAccountMap = Partial<Record<OutreachChannel, string>>;

export async function resolveAndSyncCampaignChannelAccounts(input: {
  orgId: string;
  campaignId?: string;
  channels: string[];
  sequence: SequenceStep[];
  /** Legacy LinkedIn sender id from socialAccountId body field. */
  socialAccountId?: string | null;
  /** Explicit map of channel → SocialAccount id. */
  channelAccounts?: ChannelAccountMap | null;
}): Promise<{ linkedInSocialAccountId: string | null; channelAccounts: ChannelAccountMap }> {
  const requiredChannels = new Set<OutreachChannel>([
    ...input.channels.filter(isOutreachChannel),
    ...channelsUsedInSequence(input.sequence),
  ]);

  const resolved: ChannelAccountMap = { ...(input.channelAccounts ?? {}) };

  if (requiredChannels.has("linkedin") && !resolved.linkedin && input.socialAccountId) {
    resolved.linkedin = input.socialAccountId;
  }

  for (const channel of requiredChannels) {
    const socialAccountId = resolved[channel];
    if (!socialAccountId) {
      throw new ValidationError(
        `Select an active ${channel} sender for this campaign`,
      );
    }

    const sender = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        orgId: input.orgId,
        platform: channel,
        status: "active",
      },
      select: { id: true, unipileId: true },
    });

    if (!sender?.unipileId) {
      throw new ValidationError(
        `The selected ${channel} sender is not active for this organization`,
      );
    }
  }

  if (input.campaignId) {
    await syncCampaignChannelAccountRows(input.campaignId, resolved);
  }

  return {
    linkedInSocialAccountId: resolved.linkedin ?? null,
    channelAccounts: resolved,
  };
}

async function syncCampaignChannelAccountRows(
  campaignId: string,
  channelAccounts: ChannelAccountMap,
): Promise<void> {
  const entries = Object.entries(channelAccounts).filter(
    (entry): entry is [OutreachChannel, string] =>
      isOutreachChannel(entry[0]) && typeof entry[1] === "string" && entry[1].length > 0,
  );

  await prisma.$transaction(async (tx) => {
    for (const [channel, socialAccountId] of entries) {
      await tx.campaignChannelAccount.upsert({
        where: {
          campaignId_channel: { campaignId, channel },
        },
        create: { campaignId, channel, socialAccountId },
        update: { socialAccountId },
      });
    }

    const keep = entries.map(([channel]) => channel);
    await tx.campaignChannelAccount.deleteMany({
      where: {
        campaignId,
        ...(keep.length > 0 ? { channel: { notIn: keep } } : {}),
      },
    });
  });
}

export async function getCampaignSenderForChannel(input: {
  campaignId: string;
  channel: OutreachChannel;
  /** Fallback legacy LinkedIn sender include. */
  legacyLinkedInAccount?: {
    id: string;
    accountName?: string;
    avatarUrl?: string | null;
    platform: string;
    status: string;
    unipileId: string | null;
  } | null;
}): Promise<{
  id: string;
  accountName: string;
  avatarUrl: string | null;
  platform: string;
  status: string;
  unipileId: string;
  createdAt?: Date;
} | null> {
  const row = await prisma.campaignChannelAccount.findUnique({
    where: {
      campaignId_channel: {
        campaignId: input.campaignId,
        channel: input.channel,
      },
    },
    include: {
      socialAccount: {
        select: { id: true, accountName: true, avatarUrl: true, platform: true, status: true, unipileId: true, createdAt: true },
      },
    },
  });

  if (row?.socialAccount.unipileId && row.socialAccount.status === "active") {
    return {
      id: row.socialAccount.id,
      accountName: row.socialAccount.accountName,
      avatarUrl: row.socialAccount.avatarUrl,
      platform: row.socialAccount.platform,
      status: row.socialAccount.status,
      unipileId: row.socialAccount.unipileId,
      createdAt: row.socialAccount.createdAt,
    };
  }

  if (
    input.channel === "linkedin" &&
    input.legacyLinkedInAccount?.unipileId &&
    input.legacyLinkedInAccount.status === "active" &&
    input.legacyLinkedInAccount.platform === "linkedin"
  ) {
    return {
      id: input.legacyLinkedInAccount.id,
      accountName: input.legacyLinkedInAccount.accountName ?? "LinkedIn sender",
      avatarUrl: input.legacyLinkedInAccount.avatarUrl ?? null,
      platform: input.legacyLinkedInAccount.platform,
      status: input.legacyLinkedInAccount.status,
      unipileId: input.legacyLinkedInAccount.unipileId,
    };
  }

  return null;
}

export function parseChannelAccountsBody(
  value: unknown,
): ChannelAccountMap | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("channelAccounts must be an object of channel → account id");
  }
  const result: ChannelAccountMap = {};
  for (const [channel, socialAccountId] of Object.entries(value as Record<string, unknown>)) {
    if (!isOutreachChannel(channel)) {
      throw new ValidationError(
        `Invalid channelAccounts key "${channel}". Allowed: ${OUTREACH_CHANNELS.join(", ")}`,
      );
    }
    if (typeof socialAccountId !== "string" || !socialAccountId.trim()) {
      throw new ValidationError(`channelAccounts.${channel} must be a non-empty account id`);
    }
    result[channel] = socialAccountId.trim();
  }
  return result;
}
