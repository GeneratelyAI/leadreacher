import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import Stripe from "stripe";

type CheckStatus = "passed" | "failed";

type JourneyCheck = {
  name: string;
  status: CheckStatus;
  durationMs: number;
  diagnostic: string;
};

type JourneyReport = {
  target: "staging-safe-journeys";
  runId: string;
  checkedAt: string;
  passed: boolean;
  checks: JourneyCheck[];
};

type ControlledFixtures = {
  leadId: string;
  reviewCampaignId: string;
  videoCampaignId: string;
  videoAssetId: string;
};

type CheckoutFixture = {
  organizationId: string;
  eventId: string;
  sessionId: string | null;
};

const reportPath =
  process.env.STAGING_SAFE_JOURNEYS_REPORT_PATH ?? "artifacts/staging-safe-journeys.json";

function requiredValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function baseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function diagnostic(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function writeReport(report: JourneyReport): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

async function authenticatedRequest(input: {
  apiUrl: string;
  accessToken: string;
  path: string;
  method?: "GET" | "POST";
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${input.apiUrl}${input.path}`, {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      ...(input.method === "POST" ? { "content-type": "application/json" } : {}),
    },
    ...(input.method === "POST" ? { body: "{}" } : {}),
  });
  return { status: response.status, body: await readJson(response) };
}

async function createControlledFixtures(
  db: PrismaClient,
  orgId: string,
  prefix: string,
): Promise<ControlledFixtures> {
  // Fixture setup must be all-or-nothing. A transaction prevents a failed
  // setup from leaving a synthetic lead or campaign in the controlled tenant.
  return db.$transaction(async (transaction) => {
    const lead = await transaction.lead.create({
      data: {
        orgId,
        source: "manual",
        firstName: "Staging",
        lastName: `Fixture ${prefix}`,
        company: "LeadReacher staging verification",
        title: "Synthetic test prospect",
        reviewStatus: "pending",
        tags: [],
        notes: [],
      },
    });

    const reviewCampaign = await transaction.campaign.create({
      data: {
        orgId,
        name: `staging-safe-review-${prefix}`,
        status: "draft",
        channels: [],
        sequence: [{ type: "linkedin_message", message: "Synthetic verification only", delayHours: 0 }],
        aiConfig: { stagingSafeJourneyRunId: prefix },
      },
    });
    await transaction.campaignLead.create({
      data: { campaignId: reviewCampaign.id, leadId: lead.id },
    });

    const videoCampaign = await transaction.campaign.create({
      data: {
        orgId,
        name: `staging-safe-video-${prefix}`,
        status: "draft",
        channels: [],
        sequence: [{ type: "linkedin_message", message: "Synthetic verification only", delayHours: 0 }],
        aiConfig: {
          stagingSafeJourneyRunId: prefix,
          video: {
            enabled: true,
            source: "generated",
            mode: "standardized",
            paused: false,
          },
        },
      },
    });
    await transaction.campaignLead.create({
      data: { campaignId: videoCampaign.id, leadId: lead.id },
    });
    const videoAsset = await transaction.videoAsset.create({
      data: {
        orgId,
        campaignId: videoCampaign.id,
        leadId: lead.id,
        pipeline: "standard",
        status: "failed",
        needsReview: true,
      },
    });

    return {
      leadId: lead.id,
      reviewCampaignId: reviewCampaign.id,
      videoCampaignId: videoCampaign.id,
      videoAssetId: videoAsset.id,
    };
  });
}

async function cleanupControlledFixtures(db: PrismaClient, fixtures: ControlledFixtures): Promise<void> {
  const campaignIds = [fixtures.reviewCampaignId, fixtures.videoCampaignId];
  await db.videoAsset.deleteMany({ where: { id: fixtures.videoAssetId } });
  await db.campaignLead.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  await db.lead.deleteMany({ where: { id: fixtures.leadId } });
}

async function cleanupCheckoutFixture(
  db: PrismaClient,
  stripe: Stripe,
  fixture: CheckoutFixture,
): Promise<void> {
  if (fixture.sessionId) {
    const session = await stripe.checkout.sessions.expire(fixture.sessionId);
    assertCondition(
      session.status === "expired",
      `Stripe Checkout Session ${fixture.sessionId} did not expire during cleanup`,
    );
  }
  await db.stripeWebhookEvent.deleteMany({ where: { eventId: fixture.eventId } });
  await db.organization.deleteMany({ where: { id: fixture.organizationId } });
}

async function runCheck(
  checks: JourneyCheck[],
  name: string,
  callback: () => Promise<void>,
): Promise<boolean> {
  const startedAt = Date.now();
  try {
    await callback();
    checks.push({
      name,
      status: "passed",
      durationMs: Date.now() - startedAt,
      diagnostic: "Passed without creating outreach, campaign delivery, or video-generation jobs.",
    });
    return true;
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      diagnostic: diagnostic(error),
    });
    return false;
  }
}

async function main(): Promise<void> {
  const runId = process.env.STAGING_SAFE_JOURNEYS_RUN_ID?.trim() || randomUUID();
  const prefix = `staging-safe-${runId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const apiUrl = baseUrl(requiredValue("STAGING_API_URL"));
  const databaseUrl = requiredValue("STAGING_DIRECT_URL");
  const supabaseUrl = requiredValue("STAGING_SUPABASE_URL");
  const supabaseAnonKey = requiredValue("STAGING_SUPABASE_ANON_KEY");
  const e2eEmail = requiredValue("STAGING_E2E_EMAIL");
  const e2ePassword = requiredValue("STAGING_E2E_PASSWORD");
  const stripeSecretKey = requiredValue("STAGING_STRIPE_SECRET_KEY");
  const stripeWebhookSecret = requiredValue("STAGING_STRIPE_WEBHOOK_SECRET");
  const stripePriceId = requiredValue("STAGING_STRIPE_PRICE_PERSONALIZED_OUTREACH");

  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const stripe = new Stripe(stripeSecretKey);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const checks: JourneyCheck[] = [];
  let controlledFixtures: ControlledFixtures | null = null;
  let checkoutFixture: CheckoutFixture | null = null;

  try {
    await db.$connect();

    await runCheck(checks, "stripe-test-checkout-and-signed-webhook", async () => {
      const organization = await db.organization.create({
        data: {
          name: `Staging safe checkout ${prefix}`,
          supabaseOrgId: `${prefix}-checkout`,
        },
      });
      const eventId = `evt_${randomUUID().replace(/-/g, "")}`;
      checkoutFixture = { organizationId: organization.id, eventId, sessionId: null };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: stripePriceId, quantity: 1 }],
        client_reference_id: organization.id,
        metadata: {
          orgId: organization.id,
          strategyId: `${prefix}-strategy`,
          campaignType: "personalized_outreach",
          videoEnabled: "false",
          planPriceId: stripePriceId,
          stagingSafeJourneyRunId: runId,
        },
        success_url: `${apiUrl}/health?staging-safe-checkout=success`,
        cancel_url: `${apiUrl}/health?staging-safe-checkout=cancelled`,
      });
      checkoutFixture.sessionId = session.id;
      assertCondition(session.url, "Stripe did not return a test Checkout URL");

      const eventPayload = JSON.stringify({
        id: eventId,
        type: "checkout.session.completed",
        data: {
          object: {
            id: session.id,
            client_reference_id: organization.id,
            customer: `cus_${randomUUID().replace(/-/g, "")}`,
            subscription: `sub_${randomUUID().replace(/-/g, "")}`,
            metadata: {
              orgId: organization.id,
              strategyId: `${prefix}-strategy`,
              campaignType: "personalized_outreach",
              videoEnabled: "false",
              planPriceId: stripePriceId,
              stagingSafeJourneyRunId: runId,
            },
          },
        },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: eventPayload,
        secret: stripeWebhookSecret,
      });

      const firstResponse = await fetch(`${apiUrl}/webhooks/stripe`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": signature },
        body: eventPayload,
      });
      const firstBody = asRecord(await readJson(firstResponse));
      assertCondition(firstResponse.status === 200 && firstBody?.received === true, "Staging rejected the signed Stripe webhook");

      const duplicateResponse = await fetch(`${apiUrl}/webhooks/stripe`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": signature },
        body: eventPayload,
      });
      const duplicateBody = asRecord(await readJson(duplicateResponse));
      assertCondition(
        duplicateResponse.status === 200 && duplicateBody?.duplicate === true,
        "Staging did not treat the repeated Stripe event as idempotent",
      );

      const persisted = await db.organization.findUnique({
        where: { id: organization.id },
        select: { stripeCustomerId: true, stripeSubscriptionId: true, planPriceId: true },
      });
      assertCondition(
        persisted?.stripeCustomerId &&
          persisted.stripeSubscriptionId &&
          persisted.planPriceId === stripePriceId,
        "Staging did not persist Stripe checkout metadata for the synthetic organization",
      );
    });

    let accessToken: string | null = null;
    let controlledOrgId: string | null = null;
    const authenticated = await runCheck(checks, "controlled-staging-sign-in", async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e2eEmail,
        password: e2ePassword,
      });
      if (error || !data.session || !data.user) {
        throw new Error(error?.message ?? "Staging sign-in did not return a session");
      }
      const user = await db.user.findUnique({
        where: { supabaseId: data.user.id },
        select: { orgId: true },
      });
      assertCondition(user?.orgId, "The controlled staging user has no LeadReacher organization");
      accessToken = data.session.access_token;
      controlledOrgId = user.orgId;
    });

    if (authenticated && accessToken && controlledOrgId) {
      const fixturesCreated = await runCheck(checks, "create-synthetic-dashboard-fixtures", async () => {
        controlledFixtures = await createControlledFixtures(db, controlledOrgId!, prefix);
      });

      if (fixturesCreated && controlledFixtures) {
        await runCheck(checks, "campaign-review-gate", async () => {
          const response = await authenticatedRequest({
            apiUrl,
            accessToken: accessToken!,
            path: `/campaigns/${controlledFixtures!.reviewCampaignId}/launch`,
            method: "POST",
          });
          const body = asRecord(response.body);
          assertCondition(response.status === 400, "The unreviewed synthetic campaign was not blocked");
          assertCondition(
            typeof body?.message === "string" && body.message.includes("Review every enrolled prospect before launch"),
            "The campaign review gate did not return its expected validation error",
          );
          const [campaign, messageCount] = await Promise.all([
            db.campaign.findUnique({
              where: { id: controlledFixtures!.reviewCampaignId },
              select: { status: true },
            }),
            db.message.count({ where: { campaignId: controlledFixtures!.reviewCampaignId } }),
          ]);
          assertCondition(
            campaign?.status === "draft" && messageCount === 0,
            "The blocked campaign changed state or created outreach messages",
          );
        });

        await runCheck(checks, "video-retry-state", async () => {
          const response = await authenticatedRequest({
            apiUrl,
            accessToken: accessToken!,
            path: `/campaigns/${controlledFixtures!.videoCampaignId}`,
          });
          const body = asRecord(response.body);
          const video = asRecord(body?.video);
          assertCondition(response.status === 200, "The synthetic video campaign detail did not load");
          assertCondition(
            video?.status === "failed" && video.needsReview === true,
            "The staged campaign detail did not expose a retryable video state",
          );
        });
      } else {
        checks.push(
          {
            name: "campaign-review-gate",
            status: "failed",
            durationMs: 0,
            diagnostic: "Skipped because synthetic dashboard fixture creation failed.",
          },
          {
            name: "video-retry-state",
            status: "failed",
            durationMs: 0,
            diagnostic: "Skipped because synthetic dashboard fixture creation failed.",
          },
        );
      }
    } else {
      checks.push(
        {
          name: "campaign-review-gate",
          status: "failed",
          durationMs: 0,
          diagnostic: "Skipped because controlled staging sign-in failed.",
        },
        {
          name: "video-retry-state",
          status: "failed",
          durationMs: 0,
          diagnostic: "Skipped because controlled staging sign-in failed.",
        },
      );
    }
  } finally {
    const cleanupErrors: string[] = [];
    if (controlledFixtures) {
      try {
        await cleanupControlledFixtures(db, controlledFixtures);
      } catch (error) {
        cleanupErrors.push(`dashboard fixture cleanup: ${diagnostic(error)}`);
      }
    }
    if (checkoutFixture) {
      try {
        await cleanupCheckoutFixture(db, stripe, checkoutFixture);
      } catch (error) {
        cleanupErrors.push(`Stripe fixture cleanup: ${diagnostic(error)}`);
      }
    }
    try {
      await db.$disconnect();
    } catch (error) {
      cleanupErrors.push(`database disconnect: ${diagnostic(error)}`);
    }
    try {
      await pool.end();
    } catch (error) {
      cleanupErrors.push(`database pool close: ${diagnostic(error)}`);
    }
    if (cleanupErrors.length > 0) {
      checks.push({
        name: "synthetic-fixture-cleanup",
        status: "failed",
        durationMs: 0,
        diagnostic: cleanupErrors.join("; "),
      });
    } else {
      checks.push({
        name: "synthetic-fixture-cleanup",
        status: "passed",
        durationMs: 0,
        diagnostic: "Namespaced database fixtures and the open Stripe test Checkout session were removed.",
      });
    }
  }

  const report: JourneyReport = {
    target: "staging-safe-journeys",
    runId,
    checkedAt: new Date().toISOString(),
    passed: checks.length > 0 && checks.every((check) => check.status === "passed"),
    checks,
  };
  await writeReport(report);
  console.info(JSON.stringify(report));
  if (!report.passed) {
    throw new Error(
      `Staging safe journeys failed: ${checks
        .filter((check) => check.status === "failed")
        .map((check) => check.name)
        .join(", ")}`,
    );
  }
}

void main().catch(async (error: unknown) => {
  const message = diagnostic(error);
  try {
    await writeReport({
      target: "staging-safe-journeys",
      runId: process.env.STAGING_SAFE_JOURNEYS_RUN_ID?.trim() || "unknown",
      checkedAt: new Date().toISOString(),
      passed: false,
      checks: [{
        name: "staging-safe-journeys-bootstrap",
        status: "failed",
        durationMs: 0,
        diagnostic: message,
      }],
    });
  } catch {
    // Preserve the original failure when report storage is unavailable.
  }
  console.error("Staging safe journeys failed", message);
  process.exit(1);
});
