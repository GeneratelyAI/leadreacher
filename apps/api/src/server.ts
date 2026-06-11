import Fastify from "fastify";
import "./config/env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { healthRoutes } from "./routes/health.js";
import { leadsRoutes } from "./routes/leads.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startCampaignSequenceWorker } from "./workers/campaign-sequence.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(campaignRoutes);
  await app.register(leadsRoutes);

  startCampaignSequenceWorker();

  return app;
}
