import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UnipileAdapter } from "../adapters/unipile.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";

const STATUS_REPLIED = "replied";
const STATUS_CONNECTED = "connected";

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
  provider_id: z.string(),
  timestamp: z.string(),
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

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/unipile", async (request, reply) => {
    try {
      const parsed = UnipileWebhookSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload" });
      }

      const data = parsed.data;

      if (data.event === "message_received") {
        if (await isDuplicate(data.message_id)) {
          return reply.send({ received: true, duplicate: true });
        }

        const message = await prisma.message.findFirst({
          where: { externalId: data.chat_id },
        });

        if (message) {
          await prisma.message.update({
            where: { id: message.id },
            data: { status: STATUS_REPLIED },
          });

          await prisma.lead.update({
            where: { id: message.leadId },
            data: { status: STATUS_REPLIED },
          });

          await prisma.campaignLead.updateMany({
            where: {
              campaignId: message.campaignId,
              leadId: message.leadId,
            },
            data: { status: STATUS_REPLIED },
          });
        }

        app.log.info({
          event: data.event,
          account_id: data.account_id,
          message_id: data.message_id,
          chat_id: data.chat_id,
        });
      } else if (data.event === "new_relation") {
        const lead = await prisma.lead.findFirst({
          where: {
            linkedinUrl: { contains: data.provider_id },
          },
        });

        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: STATUS_CONNECTED },
          });

          const campaignLead = await prisma.campaignLead.findFirst({
            where: { leadId: lead.id, status: "active" },
            include: { campaign: true },
          });

          if (campaignLead) {
            const socialAccount = await prisma.socialAccount.findFirst({
              where: {
                orgId: lead.orgId,
                platform: "linkedin",
                status: "active",
              },
            });

            if (socialAccount?.unipileId && data.provider_id) {
              const adapter = new UnipileAdapter({
                dsn: process.env["UNIPILE_DSN"] ?? "",
                apiKey: process.env["UNIPILE_API_KEY"] ?? "",
              });

              const chat = await adapter.startChat(
                socialAccount.unipileId,
                data.provider_id,
                (campaignLead.campaign.sequence as Array<{ message: string }>)[1]
                  ?.message ?? "",
              );

              await prisma.campaignLead.update({
                where: { id: campaignLead.id },
                data: { linkedinChatId: chat.chat_id },
              });

              await campaignSequenceQueue.add(
                QUEUE_CAMPAIGN_SEQUENCE,
                {
                  campaignLeadId: campaignLead.id,
                  orgId: lead.orgId,
                  step: 1,
                },
                { delay: 0 },
              );
            }
          }
        }

        app.log.info({
          event: data.event,
          account_id: data.account_id,
          provider_id: data.provider_id,
        });
      }

      return reply.send({ received: true });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Internal error" });
    }
  });
}
