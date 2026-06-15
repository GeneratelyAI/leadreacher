import type { FastifyInstance } from "fastify";
import { requireOrg, verifySupabaseJwt } from "../plugins/auth.js";
import { campaignRoutes } from "../routes/campaigns.js";
import { leadsRoutes } from "../routes/leads.js";
import { socialAccountRoutes } from "../routes/social-accounts.js";

export async function protectedRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", verifySupabaseJwt);
  app.addHook("preHandler", requireOrg);

  await app.register(leadsRoutes);
  await app.register(campaignRoutes);
  await app.register(socialAccountRoutes);
}
