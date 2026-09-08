import { type FastifyPluginAsync } from "fastify";
import { registerDashboardChromeRoutes } from "../features/organizations/public/dashboard-chrome-routes.js";
import { registerDashboardListRoutes } from "../features/campaigns/public/dashboard-list-routes.js";
import { registerDashboardOverviewRoutes } from "../features/analytics/public/dashboard-overview-routes.js";
import { registerDashboardVideoPauseRoutes } from "../features/content/public/dashboard-video-pause-routes.js";
import { registerDashboardVideoEnableRoutes } from "../features/content/public/dashboard-video-enable-routes.js";
import { registerDashboardActivityRoutes } from "../features/analytics/public/dashboard-activity-routes.js";
import { registerDashboardSearchRoutes } from "../features/prospects/public/dashboard-search-routes.js";
import { registerDashboardEventsRoutes } from "../features/organizations/public/dashboard-events-routes.js";
import { registerDashboardProspectRoutes } from "../features/prospects/public/dashboard-prospects-routes.js";
import { registerDashboardConversationRoutes } from "../features/messages/public/dashboard-conversations-routes.js";
import { registerDashboardAnalyticsRoutes } from "../features/analytics/public/dashboard-analytics-routes.js";
import { registerDashboardSettingsRoutes } from "../features/organizations/public/settings-routes.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const dashboardRequestTimes = new WeakMap<object, number>();

  // Keep timing available when this plugin is mounted independently in tests
  // or tooling. The full server also exposes the same timing globally.
  app.addHook("onRequest", async (request) => {
    dashboardRequestTimes.set(request, performance.now());
  });
  app.addHook("onSend", async (request, reply, payload) => {
    const startedAt = dashboardRequestTimes.get(request);
    if (startedAt !== undefined) {
      reply.header("Server-Timing", `app;dur=${(performance.now() - startedAt).toFixed(1)}`);
    }
    return payload;
  });

  await registerDashboardChromeRoutes(app);

  await registerDashboardListRoutes(app);

  await registerDashboardOverviewRoutes(app);

  await registerDashboardVideoPauseRoutes(app);

  await registerDashboardVideoEnableRoutes(app);

  await registerDashboardActivityRoutes(app);

  await registerDashboardSearchRoutes(app);

  await registerDashboardEventsRoutes(app);

  await registerDashboardProspectRoutes(app);
  await registerDashboardConversationRoutes(app);
  await registerDashboardAnalyticsRoutes(app);
  await registerDashboardSettingsRoutes(app);
};
