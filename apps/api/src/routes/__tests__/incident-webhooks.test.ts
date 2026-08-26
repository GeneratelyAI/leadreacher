import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ingestIncidentEvent } = vi.hoisted(() => ({
  ingestIncidentEvent: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    INCIDENT_AUTOFIX_ENABLED: true,
    SENTRY_WEBHOOK_SECRET: "sentry-client-secret",
    BETTERSTACK_WEBHOOK_SECRET: "better-stack-secret",
  },
}));
vi.mock("../../services/incident-ingestion.js", () => ({ ingestIncidentEvent }));

import { incidentWebhookRoutes } from "../incident-webhooks.js";

const sentryPayload = {
  action: "created",
  data: {
    issue: {
      id: "123",
      title: "TypeError in checkout",
      permalink: "https://sentry.io/issues/123",
    },
    event: { level: "error", environment: "staging" },
  },
};

function sentrySignature(payload: unknown): string {
  return createHmac("sha256", "sentry-client-secret")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

async function buildTestApp() {
  const app = Fastify();
  await app.register(incidentWebhookRoutes);
  return app;
}

describe("POST /webhooks/incidents/sentry", () => {
  beforeEach(() => {
    ingestIncidentEvent.mockReset();
    ingestIncidentEvent.mockResolvedValue({ incidentId: "incident-1", duplicate: false });
  });

  it("accepts and ingests a natively signed Sentry webhook", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/incidents/sentry",
      headers: { "sentry-hook-signature": sentrySignature(sentryPayload) },
      payload: sentryPayload,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      received: true,
      incidentId: "incident-1",
      duplicate: false,
    });
    expect(ingestIncidentEvent).toHaveBeenCalledOnce();
    await app.close();
  });

  it("rejects a changed payload with a stale Sentry signature", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/incidents/sentry",
      headers: { "sentry-hook-signature": sentrySignature(sentryPayload) },
      payload: { ...sentryPayload, action: "resolved" },
    });

    expect(response.statusCode).toBe(401);
    expect(ingestIncidentEvent).not.toHaveBeenCalled();
    await app.close();
  });

  it("keeps the existing shared-secret fallback for controlled tests", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/incidents/sentry",
      headers: { "x-leadreacher-webhook-secret": "sentry-client-secret" },
      payload: sentryPayload,
    });

    expect(response.statusCode).toBe(202);
    expect(ingestIncidentEvent).toHaveBeenCalledOnce();
    await app.close();
  });
});
