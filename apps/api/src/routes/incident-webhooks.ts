import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { AuthError, ValidationError } from "../lib/errors.js";
import { ingestIncidentEvent } from "../services/incident-ingestion.js";
import {
  normalizeBetterStackIncident,
  normalizeSentryIncident,
} from "../services/incident-normalizer.js";
import {
  INCIDENT_WEBHOOK_SECRET_HEADER,
  verifyIncidentWebhookSecret,
} from "../services/incident-webhook-auth.js";

const MAX_WEBHOOK_BYTES = 256 * 1024;

function payloadSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return MAX_WEBHOOK_BYTES + 1;
  }
}

export async function incidentWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/incidents/sentry", { bodyLimit: MAX_WEBHOOK_BYTES }, async (request, reply) => {
    if (!env.INCIDENT_AUTOFIX_ENABLED) return reply.code(202).send({ received: true, enabled: false });
    if (!verifyIncidentWebhookSecret(
      request.headers[INCIDENT_WEBHOOK_SECRET_HEADER],
      env.SENTRY_WEBHOOK_SECRET,
    )) throw new AuthError();
    if (payloadSize(request.body) > MAX_WEBHOOK_BYTES) throw new ValidationError("Payload too large");
    const result = await ingestIncidentEvent(normalizeSentryIncident(request.body));
    return reply.code(202).send({ received: true, ...result });
  });

  app.post("/webhooks/incidents/better-stack", { bodyLimit: MAX_WEBHOOK_BYTES }, async (request, reply) => {
    if (!env.INCIDENT_AUTOFIX_ENABLED) return reply.code(202).send({ received: true, enabled: false });
    if (!verifyIncidentWebhookSecret(
      request.headers[INCIDENT_WEBHOOK_SECRET_HEADER],
      env.BETTERSTACK_WEBHOOK_SECRET,
    )) throw new AuthError();
    if (payloadSize(request.body) > MAX_WEBHOOK_BYTES) throw new ValidationError("Payload too large");
    const result = await ingestIncidentEvent(normalizeBetterStackIncident(request.body));
    return reply.code(202).send({ received: true, ...result });
  });
}
