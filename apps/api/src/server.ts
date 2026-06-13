import Fastify from "fastify";
import "./config/env.js";
import { AppError } from "./lib/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { healthRoutes } from "./routes/health.js";
import { leadsRoutes } from "./routes/leads.js";
import { socialAccountRoutes } from "./routes/social-accounts.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
    }

    request.log.error(error);
    return reply.status(500).send({ error: "Internal error" });
  });

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(campaignRoutes);
  await app.register(leadsRoutes);
  await app.register(socialAccountRoutes);

  startCampaignSequenceWorker();

  return app;
}
