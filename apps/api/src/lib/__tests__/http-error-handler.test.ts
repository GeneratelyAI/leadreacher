import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  ConflictError,
  DailySendLimitError,
  ExternalServiceError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  OrganizationDisabledError,
  ServiceUnavailableError,
  SubscriptionRequiredError,
  ValidationError,
  externalServiceFailure,
} from "../errors.js";
import { httpRequestLogContext, installHttpErrorHandling } from "../http-error-handler.js";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("../sentry.js", () => ({ captureException }));

describe("HTTP error contract", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    captureException.mockReset();
    app = Fastify({ logger: false, bodyLimit: 32 });
    installHttpErrorHandling(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    [new ValidationError("Invalid input"), 400, "VALIDATION_ERROR"],
    [new AuthError(), 401, "UNAUTHORIZED"],
    [new SubscriptionRequiredError(), 402, "subscription_required"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError("Campaign"), 404, "NOT_FOUND"],
    [new ConflictError("Campaign state changed"), 409, "CONFLICT"],
    [new GoneError("Export expired"), 410, "GONE"],
    [new OrganizationDisabledError(), 423, "organization_disabled"],
    [new ExternalServiceError("Unipile", "Bad response"), 502, "EXTERNAL_SERVICE_ERROR"],
    [new ServiceUnavailableError(), 503, "SERVICE_UNAVAILABLE"],
    [externalServiceFailure("Groq", new DOMException("Timed out", "TimeoutError")), 504, "EXTERNAL_SERVICE_TIMEOUT"],
  ])("serializes %s as %i %s", async (error, status, code) => {
    app.get("/failure", async () => {
      throw error;
    });

    const response = await app.inject({ method: "GET", url: "/failure" });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({
      status,
      code,
      message: error.publicMessage ?? error.message,
      requestId: response.headers["x-request-id"],
    });
  });

  it("puts rate-limit context in safe details", async () => {
    app.get("/limit", async () => {
      throw new DailySendLimitError("2026-08-06T00:00:00.000Z");
    });

    const response = await app.inject({ method: "GET", url: "/limit" });
    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      status: 429,
      code: "daily_message_limit",
      details: { resetAt: "2026-08-06T00:00:00.000Z" },
    });
  });

  it("returns a correlated envelope for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(Number(response.headers["x-request-duration-ms"])).toBeGreaterThanOrEqual(0);
    expect(response.headers["x-retry-status"]).toBe("not-retried");
    expect(response.json()).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Route not found",
      requestId: response.headers["x-request-id"],
    });
  });

  it("preserves payload-too-large as 413 instead of converting it to 500", async () => {
    app.post("/body", async () => ({ ok: true }));
    const response = await app.inject({
      method: "POST",
      url: "/body",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ value: "x".repeat(100) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("normalizes unsupported content types without exposing parser internals", async () => {
    app.post("/body", async () => ({ ok: true }));
    const response = await app.inject({
      method: "POST",
      url: "/body",
      headers: { "content-type": "application/xml" },
      payload: "<value />",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 400, code: "INVALID_CONTENT_TYPE" });
  });

  it("hides unexpected error details and captures the exception", async () => {
    app.get("/unexpected", async () => {
      throw new Error("database password is secret");
    });
    const response = await app.inject({ method: "GET", url: "/unexpected" });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database password");
    expect(response.json()).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("does not expose raw upstream response text", async () => {
    app.get("/upstream", async () => {
      throw new ExternalServiceError("Unipile", "provider body contains a secret token");
    });
    const response = await app.inject({ method: "GET", url: "/upstream" });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("secret token");
    expect(response.json()).toMatchObject({
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Unipile request failed",
      details: { service: "Unipile" },
    });
  });
});

describe("HTTP request observability", () => {
  it("builds a safe request summary with operational identifiers", () => {
    const context = httpRequestLogContext({
      request: {
        id: "req-1",
        method: "POST",
        routeOptions: { url: "/campaigns/:campaignId/launch" },
        url: "/campaigns/campaign-1/launch?token=secret",
        headers: { "x-retry-attempt": "2", authorization: "Bearer secret" },
        params: { campaignId: "campaign-1" },
        query: {},
        body: { socialAccountId: "account-1", token: "secret" },
      },
      statusCode: 409,
      durationMs: 42.6,
      responseMessage: "Campaign could not be scheduled",
    });

    expect(context).toMatchObject({
      category: "HTTP",
      event: "http.request.completed",
      requestId: "req-1",
      method: "POST",
      endpoint: "/campaigns/:campaignId/launch",
      statusCode: 409,
      durationMs: 43,
      performance: "normal",
      response: "Campaign could not be scheduled",
      campaignId: "campaign-1",
      socialAccountId: "account-1",
      retryStatus: "attempt 2",
    });
    expect(JSON.stringify(context)).not.toContain("secret");
  });
});
