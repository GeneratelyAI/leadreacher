import { ValidationError } from "../lib/errors.js";
import { getInstagramAutomationStatus } from "../lib/rate-limiter.js";
import { prisma } from "../lib/prisma.js";
import { channelsUsedInSequence, parseSequence } from "../lib/sequence.js";
import { getCampaignSenderForChannel } from "./campaign-channel-accounts.js";
import { getWhatsAppReachability } from "./channel-reachability.js";
import { resolveInstagramCampaignIdentities, type InstagramReachability } from "./instagram-identity-resolution.js";

export async function getCampaignChannelPreflight(input: {
  campaignId: string;
  orgId: string;
  resolveInstagram?: boolean;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, orgId: input.orgId },
    select: { sequence: true, leads: { include: { lead: true } } },
  });
  if (!campaign) throw new ValidationError("Campaign was not found");
  const channels = channelsUsedInSequence(parseSequence(campaign.sequence));
  const result: {
    instagram?: InstagramReachability & { capacity: Awaited<ReturnType<typeof getInstagramAutomationStatus>> };
    whatsapp?: ReturnType<typeof getWhatsAppReachability>;
  } = {};

  if (channels.includes("instagram")) {
    const sender = await getCampaignSenderForChannel({ campaignId: input.campaignId, channel: "instagram" });
    if (!sender) throw new ValidationError("Select an active Instagram sender before checking launch readiness");
    let reachability: InstagramReachability;
    if (input.resolveInstagram) {
      reachability = await resolveInstagramCampaignIdentities({
        leads: campaign.leads.map(({ lead }) => lead),
        unipileAccountId: sender.unipileId,
      });
    } else {
      reachability = campaign.leads.reduce<InstagramReachability>((summary, { lead }) => {
        if (lead.outreachSuppressedAt) summary.suppressed += 1;
        else if (lead.instagramMessagingId) summary.reachable += 1;
        else if (lead.instagramIdentityStatus === "invalid") summary.invalid += 1;
        else if (lead.instagramIdentityStatus === "error") summary.errors += 1;
        else summary.unresolved += 1;
        return summary;
      }, { total: campaign.leads.length, reachable: 0, unresolved: 0, invalid: 0, errors: 0, suppressed: 0 });
    }
    result.instagram = { ...reachability, capacity: await getInstagramAutomationStatus(sender) };
  }

  if (channels.includes("whatsapp")) {
    result.whatsapp = getWhatsAppReachability(campaign.leads.map(({ lead }) => lead));
  }
  return result;
}
