import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { recordInboundMessageWithStore } from "../lib/inbound-message-core.js";

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === "true";
const integrationDescribe = runDatabaseIntegration ? describe : describe.skip;
const runId = process.env.INTEGRATION_TEST_RUN_ID ?? `local-${process.pid}-${Date.now()}`;

type Fixture = {
  organizationId: string;
  campaignId: string;
  campaignLeadId: string;
  leadId: string;
};

let pool: Pool;
let db: PrismaClient;
let redis: Redis;
let fixtureNumber = 0;
const fixtures: Fixture[] = [];

async function createFixture(): Promise<Fixture> {
  fixtureNumber += 1;
  const suffix = `${runId}-${fixtureNumber}`;
  const organization = await db.organization.create({
    data: {
      name: `Integration ${suffix}`,
      supabaseOrgId: `integration-${suffix}`,
    },
  });
  const campaign = await db.campaign.create({
    data: {
      orgId: organization.id,
      name: `Delivery integration ${suffix}`,
      status: "draft",
      channels: ["linkedin"],
      sequence: [
        { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
        { type: "linkedin_message", message: "Hello", delayHours: 0 },
      ],
    },
  });
  const lead = await db.lead.create({
    data: {
      orgId: organization.id,
      source: "manual",
      firstName: "Integration",
      lastName: `Prospect ${fixtureNumber}`,
      company: "LeadReacher Test",
      title: "Test contact",
      tags: [],
      notes: [],
    },
  });
  const campaignLead = await db.campaignLead.create({
    data: { campaignId: campaign.id, leadId: lead.id },
  });
  const fixture = {
    organizationId: organization.id,
    campaignId: campaign.id,
    campaignLeadId: campaignLead.id,
    leadId: lead.id,
  };
  fixtures.push(fixture);
  return fixture;
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  await db.manualDeliveryAttempt.deleteMany({ where: { campaignLeadId: fixture.campaignLeadId } });
  await db.deliveryAttempt.deleteMany({ where: { campaignLeadId: fixture.campaignLeadId } });
  await db.message.deleteMany({ where: { campaignId: fixture.campaignId } });
  await db.campaignLead.deleteMany({ where: { id: fixture.campaignLeadId } });
  await db.campaign.deleteMany({ where: { id: fixture.campaignId } });
  await db.lead.deleteMany({ where: { id: fixture.leadId } });
  await db.organization.deleteMany({ where: { id: fixture.organizationId } });
}

integrationDescribe("durable delivery persistence", () => {
  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.UPSTASH_REDIS_URL;
    if (!databaseUrl || !redisUrl) {
      throw new Error("Database and Redis URLs are required for durable delivery integration tests");
    }

    pool = new Pool({ connectionString: databaseUrl });
    db = new PrismaClient({ adapter: new PrismaPg(pool) });
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    await db.$connect();
    await redis.connect();
    await redis.ping();
  });

  afterEach(async () => {
    const fixture = fixtures.pop();
    if (fixture) await cleanupFixture(fixture);
  });

  afterAll(async () => {
    await redis?.quit();
    await db?.$disconnect();
    await pool?.end();
  });

  it("allows exactly one durable reservation for concurrent delivery attempts", async () => {
    const fixture = await createFixture();
    const results = await Promise.allSettled([
      db.deliveryAttempt.create({
        data: {
          campaignLeadId: fixture.campaignLeadId,
          stepIndex: 0,
          idempotencyKey: `delivery-${runId}-first`,
        },
      }),
      db.deliveryAttempt.create({
        data: {
          campaignLeadId: fixture.campaignLeadId,
          stepIndex: 0,
          idempotencyKey: `delivery-${runId}-duplicate`,
        },
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.deliveryAttempt.count({ where: { campaignLeadId: fixture.campaignLeadId } })).toBe(1);

    const lockKey = `integration:delivery:${fixture.campaignLeadId}:0`;
    expect(await redis.set(lockKey, "reserved", "EX", 30, "NX")).toBe("OK");
    expect(await redis.set(lockKey, "duplicate", "EX", 30, "NX")).toBeNull();
    await redis.del(lockKey);
  });

  it("permits one atomic unknown-send recovery before marking an attempt sent", async () => {
    const fixture = await createFixture();
    const attempt = await db.deliveryAttempt.create({
      data: {
        campaignLeadId: fixture.campaignLeadId,
        stepIndex: 1,
        state: "unknown",
        providerRef: `provider-${runId}`,
        idempotencyKey: `recovery-${runId}`,
      },
    });

    const claims = await Promise.all([
      db.deliveryAttempt.updateMany({
        where: { id: attempt.id, state: "unknown" },
        data: { state: "recovering" },
      }),
      db.deliveryAttempt.updateMany({
        where: { id: attempt.id, state: "unknown" },
        data: { state: "recovering" },
      }),
    ]);
    expect(claims[0].count + claims[1].count).toBe(1);

    const sent = await db.deliveryAttempt.updateMany({
      where: { id: attempt.id, state: "recovering" },
      data: { state: "sent", sentAt: new Date() },
    });
    expect(sent.count).toBe(1);
    await expect(
      db.deliveryAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
    ).resolves.toMatchObject({ state: "sent", providerRef: `provider-${runId}` });
  });

  it("prevents duplicate manual sends and records repeated inbound webhooks once", async () => {
    const fixture = await createFixture();
    const message = await db.message.create({
      data: {
        campaignId: fixture.campaignId,
        leadId: fixture.leadId,
        orgId: fixture.organizationId,
        channel: "linkedin",
        content: { type: "text", message: "Operator reply" },
        direction: "outbound",
        origin: "operator",
        status: "queued",
        stepIndex: -1,
        idempotencyKey: `manual-${runId}`,
      },
    });
    const manualReservations = await Promise.allSettled([
      db.manualDeliveryAttempt.create({
        data: { messageId: message.id, campaignLeadId: fixture.campaignLeadId },
      }),
      db.manualDeliveryAttempt.create({
        data: { messageId: message.id, campaignLeadId: fixture.campaignLeadId },
      }),
    ]);
    expect(manualReservations.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const inboundData = {
      campaignId: fixture.campaignId,
      leadId: fixture.leadId,
      orgId: fixture.organizationId,
      channel: "linkedin",
      content: { type: "text", message: "Same provider webhook" },
      direction: "inbound",
      origin: "automation",
      status: "replied",
      externalId: `inbound-${runId}`,
      stepIndex: 1,
    } as const;
    const recorded = await Promise.all([
      recordInboundMessageWithStore(db, inboundData),
      recordInboundMessageWithStore(db, inboundData),
    ]);

    expect(recorded.map((result) => result.created).sort()).toEqual([false, true]);
    expect(
      await db.message.count({ where: { id: `inbound:${inboundData.externalId}` } }),
    ).toBe(1);
  });
});
