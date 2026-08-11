/**
 * Seeds synthetic LinkedIn conversation threads for the Messages inbox UX.
 *
 * Conversations only appear in GET /dashboard/conversations when CampaignLead
 * has a linkedinChatId. This script creates (or refreshes) an active demo
 * campaign with chat IDs, multi-turn threads, and unread / needs-reply variety.
 *
 * Does not launch campaigns, enqueue jobs, or call Unipile.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-messages-inbox-demo.ts --email <login email>
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-messages-inbox-demo.ts --org <org id>
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const DEMO_TAG = "leadreacher_messages_inbox_demo";
const DEMO_CAMPAIGN_NAME = "Demo preview: Pipeline acceleration";

type ThreadKind = "needs_reply_unread" | "needs_reply_read" | "handled" | "outbound_only";

type ThreadSeed = {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  location: string;
  kind: ThreadKind;
  minutesAgoLatest: number;
};

const THREADS: ThreadSeed[] = [
  {
    firstName: "Hannah",
    lastName: "Lewis",
    company: "Common Thread",
    title: "VP Commercial",
    location: "North America",
    kind: "needs_reply_unread",
    minutesAgoLatest: 3,
  },
  {
    firstName: "Maya",
    lastName: "Chen",
    company: "Northstar Labs",
    title: "VP Growth",
    location: "San Francisco",
    kind: "needs_reply_unread",
    minutesAgoLatest: 15,
  },
  {
    firstName: "Daniel",
    lastName: "Ortiz",
    company: "Harbor & Co.",
    title: "Chief Revenue Officer",
    location: "New York",
    kind: "needs_reply_read",
    minutesAgoLatest: 42,
  },
  {
    firstName: "Priya",
    lastName: "Shah",
    company: "Lumenworks",
    title: "Head of Demand Generation",
    location: "Austin",
    kind: "needs_reply_unread",
    minutesAgoLatest: 90,
  },
  {
    firstName: "Julian",
    lastName: "Park",
    company: "Kitebridge",
    title: "Managing Director",
    location: "Chicago",
    kind: "handled",
    minutesAgoLatest: 180,
  },
  {
    firstName: "Sofia",
    lastName: "Alvarez",
    company: "Vantage Grid",
    title: "VP Operations",
    location: "Denver",
    kind: "needs_reply_read",
    minutesAgoLatest: 320,
  },
  {
    firstName: "Leo",
    lastName: "Grant",
    company: "CivicFlow",
    title: "Co-founder",
    location: "Seattle",
    kind: "handled",
    minutesAgoLatest: 640,
  },
  {
    firstName: "Nora",
    lastName: "Blake",
    company: "Arcfield",
    title: "VP Marketing",
    location: "Boston",
    kind: "needs_reply_unread",
    minutesAgoLatest: 900,
  },
  {
    firstName: "Omar",
    lastName: "Reed",
    company: "Fieldstone",
    title: "Chief Executive Officer",
    location: "Miami",
    kind: "handled",
    minutesAgoLatest: 1_400,
  },
  {
    firstName: "Evan",
    lastName: "Cole",
    company: "Cedar Systems",
    title: "Founder",
    location: "Toronto",
    kind: "outbound_only",
    minutesAgoLatest: 2_000,
  },
  {
    firstName: "Tessa",
    lastName: "Morgan",
    company: "Brightline Health",
    title: "Director of Partnerships",
    location: "London",
    kind: "needs_reply_read",
    minutesAgoLatest: 2_800,
  },
  {
    firstName: "Iris",
    lastName: "Nguyen",
    company: "BeaconWorks",
    title: "Growth Lead",
    location: "Singapore",
    kind: "outbound_only",
    minutesAgoLatest: 3_600,
  },
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
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

function outreachMessage(seed: ThreadSeed): string {
  return `Hi ${seed.firstName}, I noticed ${seed.company} is focused on scaling efficiently. We help revenue teams turn high-fit conversations into qualified pipeline. Would a short introduction next week be useful?`;
}

type DemoMessageRow = {
  content: { message: string; demoMessagesInbox: true };
  direction: "inbound" | "outbound";
  origin: "automation" | "operator";
  status: string;
  stepIndex: number;
  sentAt: Date;
  createdAt: Date;
  readAt: Date | null;
  handledAt: Date | null;
};

function buildThreadMessages(seed: ThreadSeed, index: number): DemoMessageRow[] {
  const firstOutbound = minutesAgo(seed.minutesAgoLatest + 60 * 24 * 2 + index * 11);
  const followUp = minutesAgo(seed.minutesAgoLatest + 60 * 18 + index * 7);
  const inbound = minutesAgo(seed.minutesAgoLatest);
  const operatorReply = minutesAgo(Math.max(5, seed.minutesAgoLatest - 20));

  const outbound: DemoMessageRow = {
    content: { message: outreachMessage(seed), demoMessagesInbox: true },
    direction: "outbound",
    origin: "automation",
    status: "delivered",
    stepIndex: 1,
    sentAt: firstOutbound,
    createdAt: firstOutbound,
    readAt: firstOutbound,
    handledAt: firstOutbound,
  };

  if (seed.kind === "outbound_only") {
    return [
      outbound,
      {
        content: {
          message: "Following up in case pipeline quality is still a priority this quarter.",
          demoMessagesInbox: true,
        },
        direction: "outbound",
        origin: "automation",
        status: "sent",
        stepIndex: 2,
        sentAt: followUp,
        createdAt: followUp,
        readAt: followUp,
        handledAt: followUp,
      },
    ];
  }

  const inboundUnread = seed.kind === "needs_reply_unread";
  const inboundHandled = seed.kind === "handled";
  const inboundMessage: DemoMessageRow = {
    content: {
      message:
        index % 3 === 0
          ? "Thanks for reaching out. I would be open to learning more - next Tuesday afternoon works."
          : "Appreciate the note. Can you share a short overview of how teams usually start?",
      demoMessagesInbox: true,
    },
    direction: "inbound",
    origin: "automation",
    status: "replied",
    stepIndex: 1,
    sentAt: inbound,
    createdAt: inbound,
    readAt: inboundUnread ? null : minutesAgo(Math.max(1, seed.minutesAgoLatest - 1)),
    handledAt: inboundHandled ? operatorReply : null,
  };

  if (seed.kind === "handled") {
    return [
      outbound,
      inboundMessage,
      {
        content: {
          message: "Great - I'll send a brief overview and a couple of times that work mid-week.",
          demoMessagesInbox: true,
        },
        direction: "outbound",
        origin: "operator",
        status: "sent",
        stepIndex: 2,
        sentAt: operatorReply,
        createdAt: operatorReply,
        readAt: operatorReply,
        handledAt: operatorReply,
      },
    ];
  }

  if (seed.firstName === "Hannah") {
    return [
      outbound,
      {
        content: {
          message: "Following up in case this is still on your radar for Q3 pipeline.",
          demoMessagesInbox: true,
        },
        direction: "outbound",
        origin: "automation",
        status: "opened",
        stepIndex: 2,
        sentAt: followUp,
        createdAt: followUp,
        readAt: followUp,
        handledAt: followUp,
      },
      inboundMessage,
    ];
  }

  return [outbound, inboundMessage];
}

async function insertDemoMessage(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string;
    leadId: string;
    orgId: string;
    message: DemoMessageRow;
  },
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "Message" (
      "id", "campaignId", "leadId", "orgId", "channel", "content", "direction", "origin",
      "status", "stepIndex", "sentAt", "readAt", "handledAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.campaignId},
      ${input.leadId},
      ${input.orgId},
      ${"linkedin"},
      ${JSON.stringify(input.message.content)}::jsonb,
      ${input.message.direction},
      ${input.message.origin},
      ${input.message.status},
      ${input.message.stepIndex},
      ${input.message.sentAt},
      ${input.message.readAt},
      ${input.message.handledAt},
      ${input.message.createdAt},
      ${input.message.createdAt}
    )
  `);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed production. Set ALLOW_DEMO_SEED=true only for a deliberate demo workspace.");
  }

  const orgId = await resolveOrgId();
  const sender = await prisma.socialAccount.findFirst({
    where: { orgId, platform: "linkedin", status: "active" },
    select: { id: true, accountName: true },
  });
  if (!sender) {
    throw new Error("The workspace needs an active LinkedIn social account before messages inbox demo data can be added.");
  }

  const result = await prisma.$transaction(
    async (tx) => {
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
              status: "active",
              channels: ["linkedin"],
              socialAccountId: sender.id,
              sequence: [
                { type: "linkedin_invite", message: "Hi {{FirstName}}, I would like to connect.", delayHours: 0 },
                { type: "linkedin_message", message: "{{outreachMessage}}", delayHours: 24 },
              ],
              aiConfig: { demoMessagesInbox: true, deliveryDisabled: true },
            },
          })
        : await tx.campaign.create({
            data: {
              orgId,
              name: DEMO_CAMPAIGN_NAME,
              status: "active",
              channels: ["linkedin"],
              socialAccountId: sender.id,
              sequence: [
                { type: "linkedin_invite", message: "Hi {{FirstName}}, I would like to connect.", delayHours: 0 },
                { type: "linkedin_message", message: "{{outreachMessage}}", delayHours: 24 },
              ],
              aiConfig: { demoMessagesInbox: true, deliveryDisabled: true },
            },
          });

      let messageCount = 0;

      for (const [index, seed] of THREADS.entries()) {
        const leadStatus = seed.kind === "outbound_only" ? "contacted" : "replied";
        const lead = await tx.lead.create({
          data: {
            orgId,
            source: "manual",
            email: `messages-demo-${index + 1}@example.test`,
            linkedinUrl: `https://www.linkedin.com/in/leadreacher-messages-demo-${index + 1}`,
            providerLinkedinId: `leadreacher-messages-demo-${index + 1}`,
            firstName: seed.firstName,
            lastName: seed.lastName,
            company: seed.company,
            title: seed.title,
            industry: "B2B software",
            location: seed.location,
            status: leadStatus,
            reviewStatus: "approved",
            tags: [DEMO_TAG, "synthetic"],
            notes: [],
            enrichmentData: { messagesInboxDemo: true },
            createdAt: minutesAgo(60 * 24 * (30 - index)),
            updatedAt: minutesAgo(seed.minutesAgoLatest),
          },
        });

        await tx.campaignLead.create({
          data: {
            campaignId: campaign.id,
            leadId: lead.id,
            currentStep: 2,
            linkedinChatId: `demo-chat-${orgId.slice(-6)}-${index + 1}-${randomUUID().slice(0, 8)}`,
            status: seed.kind === "outbound_only" ? "active" : "replied",
            createdAt: minutesAgo(60 * 24 * (28 - index)),
          },
        });

        const thread = buildThreadMessages(seed, index);
        for (const message of thread) {
          await insertDemoMessage(tx, {
            campaignId: campaign.id,
            leadId: lead.id,
            orgId,
            message,
          });
          messageCount += 1;
        }
      }

      return {
        campaignId: campaign.id,
        conversations: THREADS.length,
        messages: messageCount,
        sender: sender.accountName,
      };
    },
    { timeout: 30_000 },
  );

  console.log(`Seeded Messages inbox for org ${orgId}`);
  console.log(`Campaign: ${DEMO_CAMPAIGN_NAME} (${result.campaignId})`);
  console.log(`Sender: ${result.sender}`);
  console.log(`Conversations: ${result.conversations}, messages: ${result.messages}`);
  console.log("No Unipile sends or queue jobs were created.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
