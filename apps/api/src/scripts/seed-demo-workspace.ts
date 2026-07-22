/**
 * Creates deterministic, synthetic dashboard data for one existing workspace.
 *
 * This script never creates queues, integrations, or social accounts. The
 * campaign remains in review, so it cannot launch or send outreach.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api seed:demo -- --org <orgId>
 *   pnpm --filter @leadreacher/api seed:demo -- --email <login email>
 *
 * NODE_ENV=production is blocked unless ALLOW_DEMO_SEED=true is set explicitly.
 */
import { prisma } from "../lib/prisma.js";

const DEMO_TAG = "leadreacher_demo_workspace";
const DEMO_CAMPAIGN_NAME = "Demo preview: Pipeline acceleration";

type DemoProspect = {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  status: "new" | "contacted" | "connected" | "replied" | "meeting";
};

const DEMO_PROSPECTS: DemoProspect[] = [
  { firstName: "Maya", lastName: "Chen", company: "Northstar Labs", title: "VP Growth", status: "replied" },
  { firstName: "Daniel", lastName: "Ortiz", company: "Harbor & Co.", title: "Chief Revenue Officer", status: "meeting" },
  { firstName: "Priya", lastName: "Shah", company: "Lumenworks", title: "Head of Demand Generation", status: "replied" },
  { firstName: "Evan", lastName: "Cole", company: "Cedar Systems", title: "Founder", status: "contacted" },
  { firstName: "Nora", lastName: "Blake", company: "Arcfield", title: "VP Marketing", status: "connected" },
  { firstName: "Julian", lastName: "Park", company: "Kitebridge", title: "Managing Director", status: "replied" },
  { firstName: "Tessa", lastName: "Morgan", company: "Brightline Health", title: "Director of Partnerships", status: "contacted" },
  { firstName: "Omar", lastName: "Reed", company: "Fieldstone", title: "Chief Executive Officer", status: "connected" },
  { firstName: "Sofia", lastName: "Alvarez", company: "Vantage Grid", title: "VP Operations", status: "meeting" },
  { firstName: "Leo", lastName: "Grant", company: "CivicFlow", title: "Co-founder", status: "replied" },
  { firstName: "Avery", lastName: "King", company: "Palisade Studio", title: "Head of Sales", status: "contacted" },
  { firstName: "Iris", lastName: "Nguyen", company: "BeaconWorks", title: "Growth Lead", status: "connected" },
  { firstName: "Marcus", lastName: "Bell", company: "Solace Partners", title: "Partner", status: "contacted" },
  { firstName: "Elena", lastName: "Ross", company: "Nimble Stack", title: "Director of Revenue", status: "connected" },
  { firstName: "Noah", lastName: "Wilson", company: "Ridgeway AI", title: "Founder", status: "new" },
  { firstName: "Zara", lastName: "Patel", company: "Meridian Group", title: "Marketing Director", status: "contacted" },
  { firstName: "Caleb", lastName: "Young", company: "Atlas Vertex", title: "Chief Operating Officer", status: "new" },
  { firstName: "Hannah", lastName: "Lewis", company: "Common Thread", title: "VP Commercial", status: "connected" },
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireSingleTarget(): { orgId?: string; email?: string } {
  const orgId = arg("org");
  const email = arg("email");
  if (Boolean(orgId) === Boolean(email)) {
    throw new Error("Provide exactly one target: --org <orgId> or --email <login email>.");
  }
  return { orgId, email };
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1_000);
}

function firstMessage(prospect: DemoProspect): string {
  return `Hi ${prospect.firstName}, I noticed ${prospect.company} is focused on scaling efficiently. We help revenue teams turn high-fit conversations into qualified pipeline. Would a short introduction next week be useful?`;
}

async function resolveOrganizationId(target: { orgId?: string; email?: string }): Promise<string> {
  if (target.orgId) {
    const organization = await prisma.organization.findUnique({
      where: { id: target.orgId },
      select: { id: true },
    });
    if (!organization) throw new Error("No organization exists for the supplied --org value.");
    return organization.id;
  }

  const user = await prisma.user.findUnique({
    where: { email: target.email },
    select: { orgId: true },
  });
  if (!user?.orgId) throw new Error("No organization is associated with the supplied --email value.");
  return user.orgId;
}

async function seedDemoWorkspace(orgId: string): Promise<{
  campaignId: string;
  prospectCount: number;
  messageCount: number;
}> {
  return prisma.$transaction(async (tx) => {
    const existingCampaign = await tx.campaign.findFirst({
      where: { orgId, name: DEMO_CAMPAIGN_NAME },
      select: { id: true },
    });

    if (existingCampaign) {
      await tx.message.deleteMany({ where: { campaignId: existingCampaign.id } });
      await tx.videoAsset.deleteMany({ where: { campaignId: existingCampaign.id } });
      await tx.campaignLead.deleteMany({ where: { campaignId: existingCampaign.id } });
    }

    await tx.lead.deleteMany({ where: { orgId, tags: { has: DEMO_TAG } } });

    const campaign = existingCampaign
      ? await tx.campaign.update({
          where: { id: existingCampaign.id },
          data: {
            status: "review",
            channels: ["linkedin"],
            sequence: [
              { type: "linkedin_invite", message: "Hi {{FirstName}}, I would like to connect.", delayHours: 0 },
              { type: "linkedin_message", message: "{{outreachMessage}}", delayHours: 24 },
            ],
            aiConfig: { demoWorkspace: true, deliveryDisabled: true },
          },
        })
      : await tx.campaign.create({
          data: {
            orgId,
            name: DEMO_CAMPAIGN_NAME,
            status: "review",
            channels: ["linkedin"],
            sequence: [
              { type: "linkedin_invite", message: "Hi {{FirstName}}, I would like to connect.", delayHours: 0 },
              { type: "linkedin_message", message: "{{outreachMessage}}", delayHours: 24 },
            ],
            aiConfig: { demoWorkspace: true, deliveryDisabled: true },
          },
        });

    const leads = await Promise.all(
      DEMO_PROSPECTS.map((prospect, index) =>
        tx.lead.create({
          data: {
            orgId,
            source: "manual",
            email: `demo.${index + 1}@example.test`,
            linkedinUrl: `https://www.linkedin.com/in/leadreacher-demo-${index + 1}`,
            providerLinkedinId: `leadreacher-demo-${index + 1}`,
            firstName: prospect.firstName,
            lastName: prospect.lastName,
            company: prospect.company,
            title: prospect.title,
            industry: "B2B software",
            location: "North America",
            status: prospect.status,
            tags: [DEMO_TAG, "synthetic"],
            notes: [],
            enrichmentData: { demoWorkspace: true },
            createdAt: minutesAgo(60 * 24 * (21 - index)),
          },
        }),
      ),
    );

    await tx.campaignLead.createMany({
      data: leads.map((lead, index) => ({
        campaignId: campaign.id,
        leadId: lead.id,
        currentStep: DEMO_PROSPECTS[index].status === "new" ? 0 : 1,
        status: DEMO_PROSPECTS[index].status === "replied" ? "replied" : "active",
      })),
    });

    const outboundLeads = leads.slice(0, 15);
    await tx.message.createMany({
      data: outboundLeads.flatMap((lead, index) => {
        const prospect = DEMO_PROSPECTS[index];
        const occurredAt = minutesAgo(60 * 24 * (12 - Math.min(index, 11)) + index * 17);
        const records = [
          {
            campaignId: campaign.id,
            leadId: lead.id,
            orgId,
            channel: "linkedin",
            content: { body: firstMessage(prospect), demoWorkspace: true },
            direction: "outbound",
            status: index % 4 === 0 ? "opened" : "delivered",
            stepIndex: 1,
            sentAt: occurredAt,
            createdAt: occurredAt,
          },
        ];
        if (index % 5 === 0) {
          records.push({
            campaignId: campaign.id,
            leadId: lead.id,
            orgId,
            channel: "linkedin",
            content: { body: "Following up in case qualified pipeline is a priority this quarter.", demoWorkspace: true },
            direction: "outbound",
            status: "sent",
            stepIndex: 2,
            sentAt: minutesAgo(Math.max(30, 60 * 24 * (11 - index))),
            createdAt: minutesAgo(Math.max(30, 60 * 24 * (11 - index))),
          });
        }
        return records;
      }),
    });

    const repliedLeads = leads.filter((lead) => lead.status === "replied");
    await tx.message.createMany({
      data: repliedLeads.map((lead, index) => {
        const occurredAt = minutesAgo(60 * 24 * (4 - index) + 45);
        return {
          campaignId: campaign.id,
          leadId: lead.id,
          orgId,
          channel: "linkedin",
          content: { body: "Thanks for reaching out. I would be open to learning more.", demoWorkspace: true },
          direction: "inbound",
          status: "replied",
          stepIndex: 1,
          sentAt: occurredAt,
          createdAt: occurredAt,
        };
      }),
    });

    await tx.videoAsset.create({
      data: {
        orgId,
        campaignId: campaign.id,
        pipeline: "standard",
        status: "ready",
        videoUrl: "https://example.test/lead-reacher-demo-video.mp4",
        thumbnailUrl: "https://example.test/lead-reacher-demo-thumbnail.jpg",
        selectedTone: "professional",
      },
    });

    return {
      campaignId: campaign.id,
      prospectCount: leads.length,
      messageCount: outboundLeads.length + 3 + repliedLeads.length,
    };
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed production. Set ALLOW_DEMO_SEED=true only for a deliberate demo workspace.");
  }

  const orgId = await resolveOrganizationId(requireSingleTarget());
  const result = await seedDemoWorkspace(orgId);
  console.log(`Seeded ${result.prospectCount} synthetic prospects and ${result.messageCount} messages.`);
  console.log(`Demo campaign: ${result.campaignId}`);
  console.log("The campaign is in review and no integrations, queues, or outbound jobs were created.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
