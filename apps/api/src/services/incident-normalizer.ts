import { createHash } from "node:crypto";
import type { IncidentProvider } from "@prisma/client";
import {
  sanitizeIdentifier,
  sanitizeIncidentText,
  sanitizeProviderUrl,
} from "./incident-sanitizer.js";

export type NormalizedIncidentEvent = {
  provider: IncidentProvider;
  externalIssueId: string;
  fingerprint: string;
  environment: string;
  releaseSha: string;
  severity: string;
  title: string;
  providerUrl?: string;
  eventType: string;
  recovered: boolean;
  occurredAt: Date;
  context: Record<string, unknown>;
};

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function first(...values: unknown[]): unknown {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function hasIdentifier(...values: unknown[]): boolean {
  return values.some((value) => (
    typeof value === "number" && Number.isFinite(value)
  ) || (
    typeof value === "string" && value.trim().length > 0
  ));
}

export function isSentryIncidentPayload(payload: unknown): boolean {
  const root = record(payload);
  const data = record(root.data);
  const issue = record(firstObject(root.issue, data.issue, root.group, data.group));
  const event = record(firstObject(root.event, data.event));
  return hasIdentifier(
    issue.id,
    issue.shortId,
    event.groupID,
    event.issueId,
    event.eventID,
  );
}

export function isBetterStackIncidentPayload(payload: unknown): boolean {
  const root = record(payload);
  const data = record(root.data);
  const attributes = record(data.attributes);
  const error = record(root.error);
  return hasIdentifier(data.id, error.id, attributes.id, root.id);
}

function occurrenceDate(...values: unknown[]): Date {
  const raw = first(...values);
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) return parsed;
  }
  return new Date();
}

function fingerprint(parts: unknown[]): string {
  return createHash("sha256")
    .update(parts.map((part) => sanitizeIncidentText(part, 300)).join("|"))
    .digest("hex");
}

function sentryStack(event: RecordValue): Record<string, unknown> {
  const exception = record(event.exception);
  const values = Array.isArray(exception.values) ? exception.values.map(record) : [];
  const latest = values.at(-1) ?? {};
  const stacktrace = record(latest.stacktrace);
  const frames = Array.isArray(stacktrace.frames) ? stacktrace.frames.map(record).slice(-20) : [];
  return {
    exceptionType: sanitizeIncidentText(latest.type, 120) || undefined,
    exceptionValue: sanitizeIncidentText(latest.value, 500) || undefined,
    culprit: sanitizeIncidentText(event.culprit, 240) || undefined,
    message: sanitizeIncidentText(event.message, 500) || undefined,
    frames: frames.map((frame) => ({
      filename: sanitizeIncidentText(first(frame.filename, frame.abs_path), 240),
      function: sanitizeIncidentText(frame.function, 160),
      module: sanitizeIncidentText(frame.module, 160),
      line: Number.isFinite(Number(frame.lineno)) ? Number(frame.lineno) : undefined,
      column: Number.isFinite(Number(frame.colno)) ? Number(frame.colno) : undefined,
      contextLine: sanitizeIncidentText(frame.context_line, 300),
    })),
  };
}

function betterStackContext(root: RecordValue, error: RecordValue, attributes: RecordValue) {
  return {
    message: sanitizeIncidentText(first(error.message, attributes.cause, root.message), 500) || undefined,
    stackTrace: sanitizeIncidentText(first(error.stack_trace, error.stacktrace), 8_000) || undefined,
    source: sanitizeIncidentText(first(error.source, attributes.source), 160) || undefined,
  };
}

export function normalizeSentryIncident(payload: unknown): NormalizedIncidentEvent {
  const root = record(payload);
  const data = record(root.data);
  const issue = record(firstObject(root.issue, data.issue, root.group, data.group));
  const event = record(firstObject(root.event, data.event));
  const project = record(firstObject(root.project, data.project, event.project));
  const rawEventType = sanitizeIncidentText(first(root.action, root.event, root.type), 80).toLowerCase();
  const externalIssueId = sanitizeIdentifier(
    first(issue.id, issue.shortId, event.groupID, event.issueId, event.eventID),
    fingerprint([issue.title, event.title]).slice(0, 24),
  );
  const title = sanitizeIncidentText(first(issue.title, event.title, event.message, root.message), 300) || "Sentry incident";
  const environment = sanitizeIdentifier(first(event.environment, issue.environment), "production");
  const releaseSha = sanitizeIdentifier(first(record(event.release).version, event.release, issue.firstRelease), "unknown");
  const eventType = rawEventType || "issue.created";
  return {
    provider: "sentry",
    externalIssueId,
    fingerprint: fingerprint([externalIssueId, event.culprit, title, project.slug]),
    environment,
    releaseSha,
    severity: sanitizeIdentifier(first(event.level, issue.level), "error"),
    title,
    providerUrl: sanitizeProviderUrl(first(issue.permalink, issue.webUrl, root.url)),
    eventType,
    recovered: /(resolved|ignored|closed)/.test(eventType),
    occurredAt: occurrenceDate(event.dateCreated, issue.lastSeen, root.timestamp),
    context: sentryStack(event),
  };
}

export function normalizeBetterStackIncident(payload: unknown): NormalizedIncidentEvent {
  const root = record(payload);
  const data = record(root.data);
  const attributes = record(data.attributes);
  const error = record(root.error);
  const rawEventType = sanitizeIncidentText(first(root.event, root.event_type, attributes.event), 80).toLowerCase();
  const externalIssueId = sanitizeIdentifier(
    first(data.id, error.id, attributes.id, root.id),
    fingerprint([attributes.name, error.name, root.message]).slice(0, 24),
  );
  const title = sanitizeIncidentText(
    first(attributes.name, attributes.title, error.name, error.message, root.message),
    300,
  ) || "Better Stack incident";
  const environment = sanitizeIdentifier(first(attributes.environment, error.environment), "production");
  const releaseSha = sanitizeIdentifier(first(attributes.release_ref, error.release_ref), "unknown");
  const eventType = rawEventType || "started";
  return {
    provider: "better_stack",
    externalIssueId,
    fingerprint: fingerprint([externalIssueId, attributes.cause, error.fingerprint, title]),
    environment,
    releaseSha,
    severity: sanitizeIdentifier(first(attributes.severity, error.severity), "error"),
    title,
    providerUrl: sanitizeProviderUrl(first(attributes.url, error.error_url, root.error_url)),
    eventType,
    recovered: /(resolved|ignored|closed|recovered)/.test(eventType),
    occurredAt: occurrenceDate(attributes.started_at, error.last_seen_at, root.timestamp),
    context: betterStackContext(root, error, attributes),
  };
}

function firstObject(...values: unknown[]): unknown {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value));
}
