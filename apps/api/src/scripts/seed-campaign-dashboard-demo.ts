/**
 * Adds synthetic campaign-list data to one existing workspace.
 *
 * This writes database rows only. It does not launch campaigns, create queue
 * jobs, connect accounts, or call any external provider.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-campaign-dashboard-demo.ts --email <login email>
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-campaign-dashboard-demo.ts --org <org id>
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const CAMPAIGN_NAMES = [
  "Q3 Founder Outreach",
  "Pipeline Acceleration",
  "Enterprise Outreach - WA",
  "Reactivation Campaign",
  "Q2 Outreach",
];

type CampaignSeed = {
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  prospectCount: number;
  sent: number;
  replies: number;
  meetings: number;
  daysAgo: number;
};

const CAMPAIGNS: CampaignSeed[] = [
  { name: "Q3 Founder Outreach", status: "draft", prospectCount: 24, sent: 0, replies: 0, meetings: 0, daysAgo: 2 },
  { name: "Pipeline Acceleration", status: "active", prospectCount: 32, sent: 28, replies: 7, meetings: 3, daysAgo: 18 },
  { name: "Enterprise Outreach - WA", status: "active", prospectCount: 24, sent: 21, replies: 5, meetings: 2, daysAgo: 14 },
  { name: "Reactivation Campaign", status: "paused", prospectCount: 16, sent: 14, replies: 2, meetings: 1, daysAgo: 45 },
  { name: "Q2 Outreach", status: "completed", prospectCount: 20, sent: 20, replies: 6, meetings: 4, daysAgo: 80 },
];

const FIRST_NAMES = ["Maya", "Daniel", "Priya", "Evan", "Nora", "Julian", "Tessa", "Omar", "Sofia", "Leo", "Avery", "Iris", "Marcus", "Elena", "Noah", "Zara", "Caleb", "Hannah", "Grace", "Michael", "Sarah", "David", "Jennifer", "Thomas"];
const LAST_NAMES = ["Chen", "Ortiz", "Shah", "Cole", "Blake", "Park", "Morgan", "Reed", "Alvarez", "Grant", "King", "Nguyen", "Bell", "Ross", "Wilson", "Patel", "Young", "Lewis", "Hopper", "Brown", "Thompson", "Miller", "Lee", "Cohen"];
const COMPANIES = ["Northstar Labs", "Harbor & Co.", "Lumenworks", "Cedar Systems", "Arcfield", "Kitebridge", "Brightline Health", "Fieldstone", "Vantage Grid", "CivicFlow", "Palisade Studio", "BeaconWorks"];
const TITLES = ["Founder", "VP Growth", "Chief Revenue Officer", "Head of Demand Generation", "VP Marketing", "Director of Partnerships", "Head of Sales", "VP Operations"];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function daysAgo(days: number, hour = 12): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function insertDemoMessage(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string;
    leadId: string;
    orgId: string;
    content: { body: string; demoCampaignDashboard: boolean };
    direction: "inbound" | "outbound";
    status: string;
    stepIndex: number;
    sentAt?: Date;
    createdAt: Date;
  },
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "Message" ("id", "campaignId", "leadId", "orgId", "channel", "content", "direction", "status", "stepIndex", "sentAt", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${input.campaignId}, ${input.leadId}, ${input.orgId}, ${"linkedin"}, ${JSON.stringify(input.content)}::jsonb, ${input.direction}, ${input.status}, ${input.stepIndex}, ${input.sentAt ?? null}, ${input.createdAt}, ${input.createdAt})
  `);
}

async function resolveOrgId(): Promise<string> {
  const orgId = arg("org");
  const email = arg("email");
  if (Boolean(orgId) === Boolean(email)) throw new Error("Provide exactly one target: --org <id> or --email <email>.");
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
  const sender = await prisma.socialAccount.findFirst({ where: { orgId, platform: "linkedin", status: "active" }, select: { id: true } });
  if (!sender) throw new Error("The workspace needs an active LinkedIn account before campaign demo data can be added.");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findMany({ where: { orgId, name: { in: CAMPAIGN_NAMES } }, select: { id: true } });
    for (const campaign of existing) {
      await tx.message.deleteMany({ where: { campaignId: campaign.id } });
      await tx.videoAsset.deleteMany({ where: { campaignId: campaign.id } });
      await tx.campaignLead.deleteMany({ where: { campaignId: campaign.id } });
      await tx.campaign.delete({ where: { id: campaign.id } });
    }

    const createdCampaigns: string[] = [];
    let totalProspects = 0;
    let totalMessages = 0;

    for (const [campaignIndex, seed] of CAMPAIGNS.entries()) {
      const createdAt = daysAgo(seed.daysAgo);
      const campaign = await tx.campaign.create({
        data: {
          orgId,
          name: seed.name,
          status: seed.status,
          channels: ["linkedin"],
          socialAccountId: sender.id,
          sequence: [
            { type: "linkedin_invite", message: "Hi {{FirstName}}, I would like to connect.", delayHours: 0 },
            { type: "linkedin_message", message: "I noticed {{Company}} is growing. Would a short introduction be useful?", delayHours: 24 },
          ],
          aiConfig: { demoCampaignDashboard: true, deliveryDisabled: true },
          createdAt,
          updatedAt: createdAt,
        },
      });
      createdCampaigns.push(campaign.id);

      const leads = [];
      for (let index = 0; index < seed.prospectCount; index += 1) {
        const isMeeting = index < seed.meetings;
        const isReply = index < seed.replies;
        const isSent = index < seed.sent;
        const status = isMeeting ? "meeting" : isReply ? "replied" : isSent ? "contacted" : "new";
        const firstName = FIRST_NAMES[(index + campaignIndex * 3) % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(index + campaignIndex * 5) % LAST_NAMES.length];
        const lead = await tx.lead.create({
          data: {
            orgId,
            source: "manual",
            email: `campaign-demo-${campaignIndex}-${index}@example.test`,
            linkedinUrl: `https://www.linkedin.com/in/leadreacher-campaign-demo-${campaignIndex}-${index}`,
            providerLinkedinId: `leadreacher-campaign-demo-${campaignIndex}-${index}`,
            firstName,
            lastName,
            company: COMPANIES[(index + campaignIndex) % COMPANIES.length],
            title: TITLES[(index + campaignIndex) % TITLES.length],
            industry: "B2B software",
            location: "North America",
            status,
            reviewStatus: "approved",
            tags: ["leadreacher_campaign_dashboard_demo", "synthetic"],
            notes: [],
            enrichmentData: { campaignDashboardDemo: true },
            createdAt,
            updatedAt: isSent ? daysAgo(Math.max(1, seed.daysAgo - 2)) : createdAt,
          },
        });
        leads.push(lead);
      }

      await tx.campaignLead.createMany({
        data: leads.map((lead, index) => ({
          campaignId: campaign.id,
          leadId: lead.id,
          currentStep: index < seed.sent ? 1 : 0,
          status: index < seed.replies ? "replied" : "active",
          createdAt,
        })),
      });

      for (let index = 0; index < seed.sent; index += 1) {
        const lead = leads[index];
        const occurredAt = daysAgo(Math.max(1, seed.daysAgo - 2), 10 + (index % 6));
        await insertDemoMessage(tx, {
          campaignId: campaign.id,
          leadId: lead.id,
          orgId,
          content: { body: `Hi ${lead.firstName}, I noticed ${lead.company} is growing. Would a short introduction be useful?`, demoCampaignDashboard: true },
          direction: "outbound",
          status: index % 3 === 0 ? "opened" : "delivered",
          stepIndex: 1,
          sentAt: occurredAt,
          createdAt: occurredAt,
        });
        totalMessages += 1;
      }

      for (let index = 0; index < seed.replies; index += 1) {
        const lead = leads[index];
        const occurredAt = daysAgo(Math.max(0, seed.daysAgo - 1), 15 + (index % 3));
        await insertDemoMessage(tx, {
          campaignId: campaign.id,
          leadId: lead.id,
          orgId,
          content: { body: "Thanks for reaching out. I would be open to learning more.", demoCampaignDashboard: true },
          direction: "inbound",
          status: "replied",
          stepIndex: 1,
          createdAt: occurredAt,
        });
        totalMessages += 1;
      }
      totalProspects += leads.length;
    }

    return { campaigns: createdCampaigns.length, prospects: totalProspects, messages: totalMessages };
  }, { timeout: 30_000 });

  console.log(`Seeded ${result.campaigns} campaigns, ${result.prospects} prospects, and ${result.messages} messages.`);
  console.log("No campaigns were launched and no external messages were sent.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
