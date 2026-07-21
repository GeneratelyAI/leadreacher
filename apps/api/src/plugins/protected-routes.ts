import type { FastifyInstance } from "fastify";
import { requireOrg, verifySupabaseJwt } from "../plugins/auth.js";
import { campaignRoutes } from "../routes/campaigns.js";
import { discoveryRoutes } from "../routes/discovery.js";
import { leadsRoutes } from "../routes/leads.js";
import { socialAccountRoutes } from "../routes/social-accounts.js";
import { strategyRoutes } from "../routes/strategy.js";
import { billingRoutes } from "../routes/billing.js";
import { onboardingRoutes } from "../routes/onboarding.js";
import { dashboardRoutes } from "../routes/dashboard.js";

export async function protectedRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", verifySupabaseJwt);
  app.addHook("preHandler", requireOrg);

  await app.register(leadsRoutes);
  await app.register(campaignRoutes);
  await app.register(discoveryRoutes);
  await app.register(strategyRoutes);
  await app.register(billingRoutes);
  await app.register(socialAccountRoutes);
  await app.register(onboardingRoutes);
  await app.register(dashboardRoutes);
}
