import { describe, expect, it } from "vitest";
import { evaluateAutofixDiff } from "../incident-autofix-policy.js";
import {
  normalizeBetterStackIncident,
  normalizeSentryIncident,
} from "../incident-normalizer.js";
import { sanitizeIncidentText, sanitizeProviderUrl } from "../incident-sanitizer.js";
import { verifyIncidentWebhookSecret } from "../incident-webhook-auth.js";

describe("incident webhook authentication", () => {
  it("accepts only an exact configured secret", () => {
    expect(verifyIncidentWebhookSecret("correct-secret", "correct-secret")).toBe(true);
    expect(verifyIncidentWebhookSecret("incorrect", "correct-secret")).toBe(false);
    expect(verifyIncidentWebhookSecret(undefined, "correct-secret")).toBe(false);
    expect(verifyIncidentWebhookSecret("", "")).toBe(false);
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
