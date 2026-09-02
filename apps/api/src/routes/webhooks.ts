import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import crypto from "node:crypto";
import { z } from "zod";
import {
  UnipileAdapter,
} from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { normalizeUnipilePlatform } from "../lib/channels.js";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors.js";
import {
  errorResponses,
  unipileSecurity,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { invalidateDashboardChrome } from "../lib/dashboard-cache.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import { parseSequence } from "../lib/sequence.js";
import { LEAD_STATUS_CONNECTED } from "../lib/lead-status.js";
import { recordInboundMessage } from "../lib/inbound-message.js";
import { publishChatEvent } from "../lib/chat-events.js";
import { deliverSequenceStep1ViaChat } from "../services/campaign-step1-chat.js";
import { isExplicitOutreachOptOut } from "../lib/outreach-suppression.js";

const STATUS_REPLIED = "replied";

const UnipileMessageSchema = z.object({
  id: z.string(),
  sender_id: z.string(),
  chat_id: z.string(),
  text: z.string().optional().default(""),
  timestamp: z.string(),
  is_sender: z.boolean(),
});

const UnipileRelationSchema = z.object({
  id: z.string(),
  user: z.object({
    id: z.string(),
    display_name: z.string().optional(),
    public_identifier: z.string().optional(),
    profile_url: z.string().optional(),
    public_picture_url: z.string().optional(),
  }),
});

const UnipileEmailSchema = z.object({
  id: z.string(),
  message_id: z.string().optional(),
  body: z.string().optional().default(""),
  subject: z.string().optional(),
  date: z.string(),
  from: z.array(z.object({
    email: z.string(),
    display_name: z.string().optional(),
  })).optional().default([]),
});

const UnipileEventBaseSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  account_id: z.string(),
  account_provider: z.string(),
  account_name: z.string(),
  application_id: z.string(),
  application_production: z.boolean(),
  type: z.string().min(1),
  payload: z.unknown(),
}).passthrough();

const UnipileWebhookSchema = z.discriminatedUnion("type", [
  UnipileEventBaseSchema.extend({
    type: z.literal("message.new"),
    payload: UnipileMessageSchema,
  }),
  UnipileEventBaseSchema.extend({
    type: z.literal("relation.new"),
    payload: UnipileRelationSchema,
  }),
  UnipileEventBaseSchema.extend({
    type: z.literal("email.new"),
    payload: z.object({ folder_id: z.string(), email: UnipileEmailSchema }),
  }),
  UnipileEventBaseSchema.extend({
    type: z.enum([
      "account.status.running",
      "account.status.disconnected",
      "account.status.errored",
      "account.status.degraded",
      "account.status.partial",
    ]),
    payload: z.object({ timestamp: z.string() }).passthrough(),
  }),
  UnipileEventBaseSchema.extend({
    type: z.enum([
      "account.locked",
      "account.unlocked",
      "account.remove",
    ]),
    payload: z.object({}).passthrough(),
  }),
  UnipileEventBaseSchema.extend({
    type: z.enum(["account.add", "account.reconnect"]),
    payload: z.object({
      account: z.object({
        id: z.string(),
        status: z.string().optional(),
      }).passthrough(),
    }).passthrough(),
  }),
  UnipileEventBaseSchema.extend({
    type: z.enum(["message.receipt.read", "message.receipt.delivery"]),
    payload: z.object({
      chat_id: z.string(),
      message_id: z.string(),
      timestamp: z.string(),
    }).passthrough(),
  }),
]);

const SUPPORTED_UNIPILE_EVENT_TYPES: ReadonlySet<string> = new Set(
  UnipileWebhookSchema.options.flatMap((schema) => {
    const typeSchema = schema.shape.type;
    if (typeSchema instanceof z.ZodLiteral) return [typeSchema.value];
    if (typeSchema instanceof z.ZodEnum) return typeSchema.options;
    return [];
  }),
);

function webhookValidationIssues(error: z.ZodError): Array<{ path: string; code: string }> {
  return error.issues.slice(0, 10).map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
  }));
}

async function isDuplicate(externalId: string): Promise<boolean> {
  const existing = await prisma.message.findFirst({
    where: { externalId },
  });
  return existing !== null;
}

async function cancelPendingSequenceJobs(
  app: FastifyInstance,
  campaignLeadId: string,
  sequence: ReturnType<typeof parseSequence>,
): Promise<void> {
  for (let step = 0; step < sequence.length; step++) {
    try {
      await campaignSequenceQueue.remove(
        campaignSequenceJobId(campaignLeadId, step),
      );
    } catch (error) {
      app.log.info({
        reason: "failed to remove queued sequence job",
        campaignLeadId,
        step,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function verifyUnipileSignature(
  rawBody: Buffer,
  provided: string | undefined,
  secret: string,
): boolean {
  if (!provided) {
    return false;
  }
  const parts = Object.fromEntries(
    provided.split(",").map((part) => part.trim().split("=", 2)),
  );
  const timestamp = parts.t;
  const signature = parts.v0;
  const timestampNumber = Number(timestamp);
  if (!timestamp || !signature || !Number.isFinite(timestampNumber)) {
    return false;
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  const providedBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return providedBuf.length === expectedBuf.length
    && crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/webhooks/unipile",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Unipile messaging / relations / hosted-auth webhook",
        description:
          "Receives Unipile v2 events authenticated by the unipile-signature header.",
        security: [...unipileSecurity],
      },
      config: { rawBody: true },
    },
    async (request, reply) => {
    const authHeader = request.headers["unipile-signature"];
    const providedAuth =
      typeof authHeader === "string" ? authHeader : authHeader?.[0];
    if (
      !request.rawBody
      || !verifyUnipileSignature(
        Buffer.isBuffer(request.rawBody) ? request.rawBody : Buffer.from(request.rawBody),
        providedAuth,
        env.UNIPILE_WEBHOOK_SECRET,
      )
    ) {
      throw new AuthError();
    }

    const envelope = UnipileEventBaseSchema.safeParse(request.body);
    if (!envelope.success) {
      request.log.warn({
        event: "unipile.webhook.invalid_envelope",
        issues: webhookValidationIssues(envelope.error),
      }, "Rejected malformed Unipile webhook envelope");
      throw new ValidationError("Invalid payload");
    }

    if (!SUPPORTED_UNIPILE_EVENT_TYPES.has(envelope.data.type)) {
      request.log.info({
        event: "unipile.webhook.ignored",
        unipileEventId: envelope.data.id,
        unipileEventType: envelope.data.type,
        accountProvider: envelope.data.account_provider,
      }, "Acknowledged unsupported Unipile webhook event");
      return reply.send({ received: true, handled: false });
    }

    const parsed = UnipileWebhookSchema.safeParse(request.body);

    if (!parsed.success) {
      request.log.warn({
        event: "unipile.webhook.invalid_supported_event",
        unipileEventId: envelope.data.id,
        unipileEventType: envelope.data.type,
        accountProvider: envelope.data.account_provider,
        issues: webhookValidationIssues(parsed.error),
      }, "Rejected malformed supported Unipile webhook event");
      throw new ValidationError("Invalid payload");
    }

    const data = parsed.data;

    if (
      data.type === "account.status.running"
      || data.type === "account.status.disconnected"
      || data.type === "account.status.errored"
      || data.type === "account.status.degraded"
      || data.type === "account.status.partial"
    ) {
      const status = data.type === "account.status.running"
        ? "active"
        : data.type === "account.status.disconnected"
          ? "disconnected"
          : "error";
      const updated = await prisma.socialAccount.updateMany({
        where: { unipileId: data.account_id },
        data: { status },
      });
      return reply.send({ received: true, handled: updated.count > 0 });
    }

    if (data.type === "account.locked" || data.type === "account.remove") {
      const updated = await prisma.socialAccount.updateMany({
        where: { unipileId: data.account_id },
        data: { status: data.type === "account.remove" ? "disconnected" : "error" },
      });
      return reply.send({ received: true, handled: updated.count > 0 });
    }

    if (data.type === "account.unlocked") {
      const updated = await prisma.socialAccount.updateMany({
        where: { unipileId: data.account_id },
        data: { status: "reconnecting" },
      });
      return reply.send({ received: true, handled: updated.count > 0 });
    }

    if (data.type === "account.add" || data.type === "account.reconnect") {
      const updated = await prisma.socialAccount.updateMany({
        where: { unipileId: data.payload.account.id },
        data: { status: data.payload.account.status === "running" ? "active" : "reconnecting" },
      });
      return reply.send({ received: true, handled: updated.count > 0 });
    }

    if (data.type === "message.receipt.read" || data.type === "message.receipt.delivery") {
      const updated = await prisma.message.updateMany({
        where: { externalId: data.payload.message_id, direction: "outbound" },
        data: data.type === "message.receipt.read"
          ? { status: "opened", readAt: new Date(data.payload.timestamp) }
          : { status: "delivered" },
      });
      return reply.send({ received: true, handled: updated.count > 0 });
    }

    if (data.type === "message.new") {
      const message = data.payload;
      if (await isDuplicate(message.id)) {
        return reply.send({ received: true, duplicate: true });
      }

      if (message.is_sender) {
        app.log.info({
          event: data.type,
          chat_id: message.chat_id,
          reason: "outbound message.new",
        });
        return reply.send({ received: true });
      }

      const socialAccount = await prisma.socialAccount.findFirst({
        where: { unipileId: data.account_id, status: "active" },
      });

      if (!socialAccount) {
        app.log.info({
          event: data.type,
          account_id: data.account_id,
          reason: "no matching SocialAccount",
        });
        return reply.send({ received: true, handled: false });
      }

      const campaignLead = await prisma.campaignLead.findFirst({
        where: {
          campaign: { orgId: socialAccount.orgId },
          OR: [
            { providerChatId: message.chat_id },
            { linkedinChatId: message.chat_id },
          ],
        },
        include: { lead: true, campaign: true },
      });

      if (!campaignLead) {
        app.log.info({
          event: data.type,
          chat_id: message.chat_id,
          reason: "no matching CampaignLead",
        });
        return reply.send({ received: true, handled: false });
      }

      const inboundChannel = normalizeUnipilePlatform(
        socialAccount.platform || data.account_provider,
      );

      await prisma.lead.update({
        where: { id: campaignLead.leadId },
        data: {
          status: STATUS_REPLIED,
          ...(isExplicitOutreachOptOut(message.text)
            ? {
                outreachSuppressedAt: new Date(),
                outreachSuppressionReason: "explicit_opt_out",
              }
            : {}),
        },
      });

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: STATUS_REPLIED },
      });

      try {
        const sequence = parseSequence(campaignLead.campaign.sequence);
        await cancelPendingSequenceJobs(app, campaignLead.id, sequence);
      } catch (error) {
        app.log.error(error);
      }

      // Idempotent insert: a duplicate/concurrent webhook re-delivery of the
      // same message_id maps to the same deterministic id and is a no-op,
      // closing the read-then-write race in isDuplicate().
      await recordInboundMessage({
        campaignId: campaignLead.campaignId,
        leadId: campaignLead.leadId,
        orgId: socialAccount.orgId,
        channel: typeof inboundChannel === "string" ? inboundChannel : "linkedin",
        content: { type: "text", message: message.text },
        direction: "inbound",
        status: STATUS_REPLIED,
        externalId: message.id,
        stepIndex: campaignLead.currentStep,
        sentAt: new Date(message.timestamp),
      });
      await publishChatEvent({
        orgId: socialAccount.orgId,
        type: "message.created",
        campaignLeadId: campaignLead.id,
        messageId: `inbound:${message.id}`,
      });
      await invalidateDashboardChrome(socialAccount.orgId);

      app.log.info({
        event: data.type,
        account_id: data.account_id,
        message_id: message.id,
        chat_id: message.chat_id,
        channel: inboundChannel,
        inbound: true,
      });
    } else if (data.type === "email.new") {
      const email = data.payload.email;
      const externalId = email.id ?? email.message_id;
      if (!externalId) {
        return reply.send({ received: true, handled: false });
      }
      if (await isDuplicate(externalId)) {
        return reply.send({ received: true, duplicate: true });
      }

      const socialAccount = await prisma.socialAccount.findFirst({
        where: { unipileId: data.account_id, status: "active" },
      });
      if (!socialAccount) {
        return reply.send({ received: true, handled: false });
      }

      const fromEmail = email.from[0]?.email.trim().toLowerCase();
      if (!fromEmail) {
        return reply.send({ received: true, handled: false });
      }

      const threadKey = `${data.account_id}:${fromEmail}`;
      const campaignLead = await prisma.campaignLead.findFirst({
        where: {
          emailThreadKey: threadKey,
          campaign: { orgId: socialAccount.orgId },
          status: { in: ["active", "completed"] },
        },
        include: { campaign: true },
        orderBy: { createdAt: "desc" },
      });

      if (!campaignLead) {
        return reply.send({ received: true, handled: false });
      }

      await prisma.lead.update({
        where: { id: campaignLead.leadId },
        data: { status: STATUS_REPLIED },
      });
      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: STATUS_REPLIED },
      });

      try {
        const sequence = parseSequence(campaignLead.campaign.sequence);
        await cancelPendingSequenceJobs(app, campaignLead.id, sequence);
      } catch (error) {
        app.log.error(error);
      }

      await recordInboundMessage({
        campaignId: campaignLead.campaignId,
        leadId: campaignLead.leadId,
        orgId: socialAccount.orgId,
        channel: "email",
        content: {
          type: "email",
          subject: email.subject,
          body: email.body,
        },
        direction: "inbound",
        status: STATUS_REPLIED,
        externalId,
        stepIndex: campaignLead.currentStep,
        sentAt: new Date(email.date),
      });
      await publishChatEvent({
        orgId: socialAccount.orgId,
        type: "message.created",
        campaignLeadId: campaignLead.id,
        messageId: `inbound:${externalId}`,
      });
    } else if (data.type === "relation.new") {
      const relation = data.payload;
      const relatedUser = relation.user;
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { unipileId: data.account_id, status: "active" },
      });

      if (!socialAccount) {
        app.log.info({
          event: data.type,
          account_id: data.account_id,
          reason: "no matching SocialAccount",
        });
        return reply.send({ received: true, handled: false });
      }

      // CSV-imported leads have no providerLinkedinId and cannot match here until enrichment exists.
      const lead = await prisma.lead.findFirst({
        where: {
          orgId: socialAccount.orgId,
          providerLinkedinId: relatedUser.id,
        },
      });

      if (!lead) {
        app.log.info({
          event: data.type,
          user_provider_id: relatedUser.id,
          reason: "no matching Lead",
        });
        return reply.send({ received: true, handled: false });
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: LEAD_STATUS_CONNECTED },
      });

      const campaignLead = await prisma.campaignLead.findFirst({
        where: {
          leadId: lead.id,
          status: "active",
          campaign: { socialAccountId: socialAccount.id },
        },
        include: { campaign: true },
      });

      if (!campaignLead) {
        app.log.info({
          event: data.type,
          leadId: lead.id,
          reason: "no active CampaignLead",
        });
        return reply.send({ received: true, handled: false });
      }

      if (campaignLead.linkedinChatId) {
        return reply.send({ received: true, duplicate: true });
      }

      if (!socialAccount.unipileId || !relatedUser.id) {
        return reply.send({ received: true, handled: false });
      }

      let sequence: ReturnType<typeof parseSequence>;
      try {
        sequence = parseSequence(campaignLead.campaign.sequence);
      } catch (error) {
        app.log.error(error);
        return reply.send({ received: true, handled: false });
      }

      const step1 = sequence[1];
      if (!step1) {
        app.log.info({
          event: data.type,
          campaignLeadId: campaignLead.id,
          reason: "no sequence step 1",
        });
        return reply.send({ received: true, handled: false });
      }

      try {
        const adapter = new UnipileAdapter({
          apiKey: env.UNIPILE_API_KEY,
        });

        const result = await deliverSequenceStep1ViaChat({
          adapter,
          campaignLeadId: campaignLead.id,
          orgId: socialAccount.orgId,
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          attendeeProviderId: relatedUser.id,
          unipileAccountId: socialAccount.unipileId,
          sequence,
          existingChatId: campaignLead.linkedinChatId,
        });

        if ("skipped" in result) {
          app.log.info({
            event: data.type,
            campaignLeadId: campaignLead.id,
            reason: result.reason,
          });
        }
      } catch (error) {
        // Return 200 on vendor failures to avoid Unipile retry storms; ops must monitor logs.
        if (error instanceof ExternalServiceError) {
          app.log.error(error);
          return reply.send({ received: true, error: true });
        }
        throw error;
      }

      app.log.info({
        event: data.type,
        account_id: data.account_id,
        user_provider_id: relatedUser.id,
      });
    }

    return reply.send({ received: true });
    },
  );
}
