import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import { parseSequence } from "../lib/sequence.js";

const STATUS_REPLIED = "replied";
const STATUS_CONTACTED = "contacted";

const UnipileMessageReceivedSchema = z.object({
  event: z.literal("message_received"),
  account_id: z.string(),
  account_type: z.string(),
  message_id: z.string(),
  chat_id: z.string(),
  message: z.string(),
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

async function isDuplicate(externalId: string): Promise<boolean> {
  const existing = await prisma.message.findFirst({
    where: { externalId },
  });
  return existing !== null;
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
  app.post("/webhooks/unipile", async (request, reply) => {
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
      });

      if (!campaignLead) {
        app.log.info({
          event: data.event,
          chat_id: data.chat_id,
          reason: "no matching CampaignLead",
        });
        return reply.send({ received: true, handled: false });
      }

      await prisma.message.updateMany({
        where: {
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
        },
        data: { status: STATUS_REPLIED },
      });

      await prisma.lead.update({
        where: { id: campaignLead.leadId },
        data: { status: STATUS_REPLIED },
      });

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: STATUS_REPLIED },
      });

      app.log.info({
        event: data.event,
        account_id: data.account_id,
        message_id: data.message_id,
        chat_id: data.chat_id,
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
        data: { status: STATUS_CONTACTED },
      });

      const campaignLead = await prisma.campaignLead.findFirst({
        where: { leadId: lead.id, status: "active" },
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

        const chat = await adapter.startChat(
          socialAccount.unipileId,
          data.user_provider_id,
          step1.message,
        );

        await prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: {
            linkedinChatId: chat.chat_id,
            currentStep: 2,
          },
        });

        await prisma.message.create({
          data: {
            campaignId: campaignLead.campaignId,
            leadId: campaignLead.leadId,
            orgId: socialAccount.orgId,
            channel: "linkedin",
            content: { type: "text", message: step1.message },
            status: "sent",
            stepIndex: 1,
            sentAt: new Date(),
            externalId: chat.chat_id,
          },
        });

        const step2 = sequence[2];
        if (step2) {
          const delayMs = step2.delayHours * 60 * 60 * 1000;
          await campaignSequenceQueue.add(
            QUEUE_CAMPAIGN_SEQUENCE,
            {
              campaignLeadId: campaignLead.id,
              orgId: socialAccount.orgId,
              step: 2,
            },
            {
              delay: delayMs,
              jobId: campaignSequenceJobId(campaignLead.id, 2),
            },
          );
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
  });
}
