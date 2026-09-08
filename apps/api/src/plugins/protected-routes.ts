import type { FastifyInstance } from "fastify";
import { requireOrg, verifySupabaseJwt } from "../platform/auth/hooks.js";
import { campaignRoutes } from "../features/campaigns/public/campaigns-routes.js";
import { discoveryRoutes } from "../features/onboarding/public/discovery-routes.js";
import { leadsRoutes } from "../features/prospects/public/leads-routes.js";
import { socialAccountRoutes } from "../features/channels/public/social-accounts-routes.js";
import { strategyRoutes } from "../features/onboarding/public/strategy-routes.js";
import { billingRoutes } from "../features/billing/public/routes.js";
import { onboardingRoutes } from "../features/onboarding/public/onboarding-routes.js";
import { dashboardRoutes } from "../routes/dashboard.js";
import { dataRightsRoutes } from "../features/organizations/public/data-rights.js";

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
  await app.register(dataRightsRoutes);
}
