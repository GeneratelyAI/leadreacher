import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluateAutofixDiff } from "../incident-autofix-policy.js";
import {
  isBetterStackIncidentPayload,
  isSentryIncidentPayload,
  normalizeBetterStackIncident,
  normalizeSentryIncident,
} from "../incident-normalizer.js";
import { sanitizeIncidentText, sanitizeProviderUrl } from "../incident-sanitizer.js";
import {
  verifyIncidentWebhookSecret,
  verifySentryWebhookSignature,
} from "../incident-webhook-auth.js";
import {
  canClaimSubscriptionRepair,
  SUBSCRIPTION_CLAIM_STALE_MS,
} from "../incident-subscription-runner.js";

describe("incident webhook authentication", () => {
  it("accepts only an exact configured secret", () => {
    expect(verifyIncidentWebhookSecret("correct-secret", "correct-secret")).toBe(true);
    expect(verifyIncidentWebhookSecret("incorrect", "correct-secret")).toBe(false);
    expect(verifyIncidentWebhookSecret(undefined, "correct-secret")).toBe(false);
    expect(verifyIncidentWebhookSecret("", "")).toBe(false);
  });

  it("accepts Sentry's native HMAC signature for the exact payload", () => {
    const payload = { action: "created", data: { issue: { id: "123" } } };
    const secret = "sentry-client-secret";
    const signature = createHmac("sha256", secret)
      .update(JSON.stringify(payload), "utf8")
      .digest("hex");

    expect(verifySentryWebhookSignature(payload, signature, secret)).toBe(true);
    expect(verifySentryWebhookSignature({ ...payload, action: "resolved" }, signature, secret))
      .toBe(false);
    expect(verifySentryWebhookSignature(payload, `${signature}0`, secret)).toBe(false);
    expect(verifySentryWebhookSignature(payload, [signature], secret)).toBe(false);
    expect(verifySentryWebhookSignature(payload, undefined, secret)).toBe(false);
    expect(verifySentryWebhookSignature(payload, signature, "")).toBe(false);
  });
});

describe("incident sanitization", () => {
  it("removes common credentials and personal identifiers", () => {
    const sanitized = sanitizeIncidentText(
      "Authorization=Bearer abc.def email=user@example.com ip=192.168.10.42 token=supersecret",
    );
    expect(sanitized).not.toContain("abc.def");
    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("192.168.10.42");
    expect(sanitized).not.toContain("supersecret");
  });

  it("keeps only a safe provider URL origin and path", () => {
    expect(sanitizeProviderUrl("https://user:pass@sentry.io/issues/42?token=secret#event"))
      .toBe("https://sentry.io/issues/42");
    expect(sanitizeProviderUrl("http://sentry.io/issues/42")).toBeUndefined();
  });
});

describe("incident normalization", () => {
  it("rejects provider payloads without a stable incident identity", () => {
    expect(isSentryIncidentPayload({})).toBe(false);
    expect(isBetterStackIncidentPayload({ data: { attributes: { name: "Missing id" } } })).toBe(false);
    expect(isSentryIncidentPayload({ data: { issue: { id: "123" } } })).toBe(true);
    expect(isBetterStackIncidentPayload({ data: { id: "456" } })).toBe(true);
  });

  it("normalizes a Sentry issue event without trusting arbitrary fields", () => {
    const event = normalizeSentryIncident({
      action: "created",
      data: {
        issue: { id: "123", title: "TypeError in checkout", permalink: "https://sentry.io/issues/123?token=x" },
        event: {
          level: "error",
          environment: "production",
          release: { version: "abc123" },
          exception: {
            values: [{
              type: "TypeError",
              value: "token=supersecret",
              stacktrace: { frames: [{ filename: "src/checkout.ts", lineno: 42 }] },
            }],
          },
        },
      },
    });
    expect(event).toMatchObject({
      provider: "sentry",
      externalIssueId: "123",
      releaseSha: "abc123",
      recovered: false,
      providerUrl: "https://sentry.io/issues/123",
    });
    expect(event.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event.context)).not.toContain("supersecret");
    expect(event.context.frames).toEqual(expect.arrayContaining([
      expect.objectContaining({ filename: "src/checkout.ts", line: 42 }),
    ]));
  });

  it("recognizes a recovered Better Stack incident", () => {
    const event = normalizeBetterStackIncident({
      event_type: "incident_resolved",
      data: { id: "456", attributes: { name: "API latency", environment: "staging" } },
    });
    expect(event.provider).toBe("better_stack");
    expect(event.externalIssueId).toBe("456");
    expect(event.recovered).toBe(true);
  });
});

describe("incident autofix policy", () => {
  it("allows a small application fix with a regression test", () => {
    expect(evaluateAutofixDiff({
      files: ["apps/api/src/services/example.ts", "apps/api/src/services/__tests__/example.test.ts"],
      additions: 28,
      deletions: 4,
      deletedFiles: [],
      hasRegressionTest: true,
    })).toEqual({ risk: "low", autoMergeAllowed: true, reasons: [] });
  });

  it("prohibits sensitive paths and file deletion", () => {
    const decision = evaluateAutofixDiff({
      files: ["apps/api/prisma/schema.prisma", ".github/workflows/ci.yml"],
      additions: 2,
      deletions: 30,
      deletedFiles: [".github/workflows/ci.yml"],
      hasRegressionTest: false,
    });
    expect(decision.risk).toBe("prohibited");
    expect(decision.autoMergeAllowed).toBe(false);
  });

  it("requires a regression test and bounded diff", () => {
    const decision = evaluateAutofixDiff({
      files: Array.from({ length: 9 }, (_, index) => `apps/api/src/services/file-${index}.ts`),
      additions: 400,
      deletions: 0,
      deletedFiles: [],
      hasRegressionTest: false,
    });
    expect(decision.risk).toBe("high");
    expect(decision.reasons).toContain("No regression test was added or updated");
  });
});

describe("subscription incident claims", () => {
  const now = Date.UTC(2026, 7, 26, 18, 0, 0);

  it("claims prepared incidents without requiring an API-backed GitHub runner", () => {
    expect(canClaimSubscriptionRepair({
      status: "dispatched",
      attemptCount: 1,
      updatedAt: new Date(now),
    }, now)).toBe(true);
  });

  it("reclaims only stale interrupted Codex runs", () => {
    expect(canClaimSubscriptionRepair({
      status: "repairing",
      attemptCount: 1,
      updatedAt: new Date(now - SUBSCRIPTION_CLAIM_STALE_MS - 1),
    }, now)).toBe(true);
    expect(canClaimSubscriptionRepair({
      status: "repairing",
      attemptCount: 1,
      updatedAt: new Date(now - 1_000),
    }, now)).toBe(false);
  });

  it("respects the repair attempt limit", () => {
    expect(canClaimSubscriptionRepair({
      status: "dispatched",
      attemptCount: 3,
      updatedAt: new Date(now),
    }, now)).toBe(false);
  });
});
