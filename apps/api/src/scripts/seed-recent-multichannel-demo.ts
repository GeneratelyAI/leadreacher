/**
 * Adds deterministic recent multi-channel analytics data to one demo workspace.
 *
 * The campaigns are completed and delivery-disabled. This script never creates
 * social accounts, queue jobs, provider chats, or external deliveries.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-recent-multichannel-demo.ts --email <login email>
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-recent-multichannel-demo.ts --org <org id>
 */
import { prisma } from "../lib/prisma.js";

const DEMO_TAG = "leadreacher_recent_multichannel_demo";

const CHANNELS = [
  { channel: "whatsapp", campaignName: "Recent WhatsApp Conversations", sent: 12, replies: 5, meetings: 2 },
  { channel: "instagram", campaignName: "Recent Instagram Outreach", sent: 10, replies: 3, meetings: 1 },
  { channel: "google", campaignName: "Recent Gmail Follow-up", sent: 7, replies: 2, meetings: 1 },
  { channel: "microsoft", campaignName: "Recent Outlook Follow-up", sent: 7, replies: 2, meetings: 1 },
  { channel: "facebook", campaignName: "Recent Messenger Outreach", sent: 8, replies: 2, meetings: 1 },
] as const;

const FIRST_NAMES = ["Amelia", "Mateo", "Layla", "Theo", "Camila", "Lucas", "Aisha", "Henry", "Nina", "Samuel", "Ivy", "Arthur", "Mila", "Elias"];
const LAST_NAMES = ["Stone", "Costa", "Rahman", "Brooks", "Silva", "Turner", "Khan", "Martin", "Park", "Bennett", "Santos", "Reed", "Foster", "Young"];
const COMPANIES = ["Orbit Works", "Summit Labs", "Meridian Health", "Brightpath", "Northline", "Vector Studio", "Clearwater", "Nova Systems"];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function recentDate(dayOffset: number, hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - dayOffset);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function resolveOrgId(): Promise<string> {
  const orgId = arg("org");
  const email = arg("email");
  if (Boolean(orgId) === Boolean(email)) {
    throw new Error("Provide exactly one target: --org <id> or --email <email>.");
  }
  if (orgId) {
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) throw new Error("No organization exists for the supplied --org value.");
    return organization.id;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { orgId: true } });
  if (!user?.orgId) throw new Error("No organization is associated with the supplied --email value.");
  return user.orgId;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed production. Set ALLOW_DEMO_SEED=true only for a deliberate demo workspace.");
  }

  const orgId = await resolveOrgId();
  const result = await prisma.$transaction(async (tx) => {
    const existingCampaigns = await tx.campaign.findMany({
      where: { orgId, aiConfig: { path: ["recentMultichannelDemo"], equals: true } },
      select: { id: true },
    });
    const campaignIds = existingCampaigns.map((campaign) => campaign.id);
    if (campaignIds.length) {
      await tx.message.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.campaignLead.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    }
    await tx.lead.deleteMany({ where: { orgId, tags: { has: DEMO_TAG } } });

    let leadCount = 0;
    let messageCount = 0;
    let replyCount = 0;
    let meetingCount = 0;

    for (const [channelIndex, seed] of CHANNELS.entries()) {
      const campaign = await tx.campaign.create({
        data: {
          orgId,
          name: seed.campaignName,
          status: "completed",
          channels: [seed.channel],
          sequence: [{ type: `${seed.channel}_message`, message: "Recent demo outreach", delayHours: 0 }],
          aiConfig: { recentMultichannelDemo: true, deliveryDisabled: true },
          createdAt: recentDate(6, 9 + channelIndex),
          updatedAt: recentDate(0, 10 + channelIndex),
        },
      });

      const leads = await Promise.all(Array.from({ length: seed.sent }, async (_, index) => {
        const isMeeting = index < seed.meetings;
        const isReply = index < seed.replies;
        const dayOffset = (index + channelIndex) % 7;
        return tx.lead.create({
          data: {
            orgId,
            source: "manual",
            email: `recent-${seed.channel}-${index}@example.test`,
            phone: seed.channel === "whatsapp" ? `+155500${channelIndex}${String(index).padStart(2, "0")}` : null,
            firstName: FIRST_NAMES[(index + channelIndex * 3) % FIRST_NAMES.length],
            lastName: LAST_NAMES[(index + channelIndex * 2) % LAST_NAMES.length],
            company: COMPANIES[(index + channelIndex) % COMPANIES.length],
            title: "Revenue leader",
            industry: "B2B services",
            location: "North America",
            status: isMeeting ? "meeting" : isReply ? "replied" : "contacted",
            reviewStatus: "approved",
            tags: [DEMO_TAG, "synthetic", seed.channel],
            notes: [],
            enrichmentData: { recentMultichannelDemo: true, channel: seed.channel },
            createdAt: recentDate(dayOffset, 8),
            updatedAt: recentDate(dayOffset, 16),
          },
        });
      }));

      await tx.campaignLead.createMany({
        data: leads.map((lead, index) => ({
          campaignId: campaign.id,
          leadId: lead.id,
          currentStep: 1,
          status: index < seed.replies ? "replied" : "completed",
          createdAt: recentDate((index + channelIndex) % 7, 8),
        })),
      });

      await tx.message.createMany({
        data: leads.flatMap((lead, index) => {
          const dayOffset = (index + channelIndex) % 7;
          const sentAt = recentDate(dayOffset, 10 + (index % 4));
          const messages = [{
            campaignId: campaign.id,
            leadId: lead.id,
            orgId,
            channel: seed.channel,
            content: { body: `Recent ${seed.channel} outreach to ${lead.firstName}.`, recentMultichannelDemo: true },
            direction: "outbound",
            origin: "automation",
            status: "delivered",
            stepIndex: 0,
            sentAt,
            createdAt: sentAt,
          }];
          if (index < seed.replies) {
            const repliedAt = recentDate(dayOffset, 15 + (index % 3));
            messages.push({
              campaignId: campaign.id,
              leadId: lead.id,
              orgId,
              channel: seed.channel,
              content: { body: "Thanks, I would be interested in learning more.", recentMultichannelDemo: true },
              direction: "inbound",
              origin: "automation",
              status: "replied",
              stepIndex: 0,
              sentAt: repliedAt,
              createdAt: repliedAt,
            });
          }
          return messages;
        }),
      });

      leadCount += leads.length;
      messageCount += seed.sent + seed.replies;
      replyCount += seed.replies;
      meetingCount += seed.meetings;
    }

    return { campaigns: CHANNELS.length, leads: leadCount, messages: messageCount, replies: replyCount, meetings: meetingCount };
  }, { timeout: 30_000 });

  console.log(JSON.stringify(result));
  console.log("No social accounts, jobs, provider chats, or external deliveries were created.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
