import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import crypto from "node:crypto";
import { z } from "zod";
import {
  decodeHostedAuthName,
  isAccountHealthy,
  UnipileAdapter,
} from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";
import {
  errorResponses,
  unipileSecurity,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import { parseSequence } from "../lib/sequence.js";
import { LEAD_STATUS_CONNECTED } from "../lib/lead-status.js";
import { recordInboundMessage } from "../lib/inbound-message.js";
import { deliverSequenceStep1ViaChat } from "../services/campaign-step1-chat.js";

const STATUS_REPLIED = "replied";

const UnipileMessageReceivedSchema = z.object({
  event: z.literal("message_received"),
  account_id: z.string(),
  account_type: z.string(),
  message_id: z.string(),
  chat_id: z.string(),
  message: z.string(),
  account_info: z.object({
    user_id: z.string(),
    type: z.string().optional(),
    feature: z.string().optional(),
  }),
  sender: z.object({
    attendee_id: z.string(),
    attendee_name: z.string(),
    attendee_provider_id: z.string(),
    attendee_profile_url: z.string().optional(),
  }),
  timestamp: z.string(),
});

const UnipileNewRelationSchema = z.object({
  event: z.literal("new_relation"),
  account_id: z.string(),
  account_type: z.string(),
  webhook_name: z.string(),
  user_full_name: z.string(),
  user_provider_id: z.string(),
  user_public_identifier: z.string(),
  user_profile_url: z.string(),
  user_picture_url: z.string().optional(),
});

const UnipileWebhookSchema = z.discriminatedUnion("event", [
  UnipileMessageReceivedSchema,
  UnipileNewRelationSchema,
]);

const UnipileHostedAuthCallbackSchema = z.object({
  status: z.enum(["CREATION_SUCCESS", "RECONNECTED"]),
  account_id: z.string().min(1),
  name: z.string().min(1),
});

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
  for (let step = 2; step < sequence.length; step++) {
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

function verifyUnipileAuthHeader(
  provided: string | undefined,
  secret: string,
): boolean {
  if (!provided) {
    return false;
  }

  const providedBuf = Buffer.from(provided, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");

  if (providedBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, secretBuf);
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
          "Receives Unipile events. Authenticate with the Unipile-Auth header. Do not try from Scalar.",
        security: [...unipileSecurity],
      },
    },
    async (request, reply) => {
    const hostedAuthCallback = UnipileHostedAuthCallbackSchema.safeParse(
      request.body,
    );
    if (hostedAuthCallback.success) {
      const orgId = decodeHostedAuthName(hostedAuthCallback.data.name);
      if (!orgId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const adapter = new UnipileAdapter({
        dsn: env.UNIPILE_DSN,
        apiKey: env.UNIPILE_API_KEY,
      });
      const account = await adapter.getAccountStatus(
        hostedAuthCallback.data.account_id,
      );
      const status = isAccountHealthy(account) ? "active" : "reconnecting";
      const platform = account.type.toLowerCase();

      await prisma.socialAccount.upsert({
        where: {
          orgId_platform_platformUserId: {
            orgId,
            platform,
            platformUserId: account.id,
          },
        },
        create: {
          orgId,
          platform,
          platformUserId: account.id,
          unipileId: account.id,
          accountName: account.name,
          status,
        },
        update: {
          unipileId: account.id,
          accountName: account.name,
          status,
        },
      });

      return reply.send({ received: true, handled: true });
    }

    const authHeader = request.headers["unipile-auth"];
    const providedAuth =
      typeof authHeader === "string" ? authHeader : authHeader?.[0];

    if (!verifyUnipileAuthHeader(providedAuth, env.UNIPILE_WEBHOOK_SECRET)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = UnipileWebhookSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload" });
    }

    const data = parsed.data;

    if (data.event === "message_received") {
      if (await isDuplicate(data.message_id)) {
        return reply.send({ received: true, duplicate: true });
      }

      const isOutbound =
        data.sender.attendee_provider_id === data.account_info.user_id;
      if (isOutbound) {
        app.log.info({
          event: data.event,
          chat_id: data.chat_id,
          reason: "outbound message_received",
          sender_provider_id: data.sender.attendee_provider_id,
          account_user_id: data.account_info.user_id,
        });
        return reply.send({ received: true });
      }

      const socialAccount = await prisma.socialAccount.findFirst({
        where: { unipileId: data.account_id, status: "active" },
      });

      if (!socialAccount) {
        app.log.info({
          event: data.event,
          account_id: data.account_id,
          reason: "no matching SocialAccount",
        });
        return reply.send({ received: true, handled: false });
      }

      const campaignLead = await prisma.campaignLead.findFirst({
        where: {
          linkedinChatId: data.chat_id,
          campaign: { orgId: socialAccount.orgId },
        },
        include: { lead: true, campaign: true },
      });

      if (!campaignLead) {
        app.log.info({
          event: data.event,
          chat_id: data.chat_id,
          reason: "no matching CampaignLead",
        });
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

      // Idempotent insert: a duplicate/concurrent webhook re-delivery of the
      // same message_id maps to the same deterministic id and is a no-op,
      // closing the read-then-write race in isDuplicate().
      await recordInboundMessage({
        campaignId: campaignLead.campaignId,
        leadId: campaignLead.leadId,
        orgId: socialAccount.orgId,
        channel: "linkedin",
        content: { type: "text", message: data.message },
        direction: "inbound",
        status: STATUS_REPLIED,
        externalId: data.message_id,
        stepIndex: campaignLead.currentStep,
        sentAt: new Date(data.timestamp),
      });

      app.log.info({
        event: data.event,
        account_id: data.account_id,
        message_id: data.message_id,
        chat_id: data.chat_id,
        inbound: true,
      });
    } else if (data.event === "new_relation") {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { unipileId: data.account_id, status: "active" },
      });

      if (!socialAccount) {
        app.log.info({
          event: data.event,
          account_id: data.account_id,
          reason: "no matching SocialAccount",
        });
        return reply.send({ received: true, handled: false });
      }

      // CSV-imported leads have no providerLinkedinId and cannot match here until enrichment exists.
      const lead = await prisma.lead.findFirst({
        where: {
          orgId: socialAccount.orgId,
          providerLinkedinId: data.user_provider_id,
        },
      });

      if (!lead) {
        app.log.info({
          event: data.event,
          user_provider_id: data.user_provider_id,
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
          event: data.event,
          leadId: lead.id,
          reason: "no active CampaignLead",
        });
        return reply.send({ received: true, handled: false });
      }

      if (campaignLead.linkedinChatId) {
        return reply.send({ received: true, duplicate: true });
      }

      if (!socialAccount.unipileId || !data.user_provider_id) {
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
          event: data.event,
          campaignLeadId: campaignLead.id,
          reason: "no sequence step 1",
        });
        return reply.send({ received: true, handled: false });
      }

      try {
        const adapter = new UnipileAdapter({
          dsn: env.UNIPILE_DSN,
          apiKey: env.UNIPILE_API_KEY,
        });

        const result = await deliverSequenceStep1ViaChat({
          adapter,
          campaignLeadId: campaignLead.id,
          orgId: socialAccount.orgId,
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          attendeeProviderId: data.user_provider_id,
          unipileAccountId: socialAccount.unipileId,
          sequence,
          existingChatId: campaignLead.linkedinChatId,
        });

        if ("skipped" in result) {
          app.log.info({
            event: data.event,
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
        event: data.event,
        account_id: data.account_id,
        user_provider_id: data.user_provider_id,
      });
    }

    return reply.send({ received: true });
    },
  );
}
