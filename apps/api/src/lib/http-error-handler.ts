import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  AppError,
  ExternalServiceError,
  ExternalServiceTimeoutError,
  apiErrorResponse,
} from "./errors.js";
import { captureException } from "./sentry.js";

type FastifyHttpError = {
  code?: string;
  statusCode?: number;
  message?: string;
};

type RequestLogState = {
  startedAt: number;
  requestedAt: string;
  responseMessage?: string;
};

const OPERATIONAL_ID_KEYS = [
  "campaignId",
  "accountId",
  "socialAccountId",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function operationalIds(request: { params: unknown; query: unknown; body: unknown }): Record<string, string> {
  const sources = [request.params, request.query, request.body]
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => value !== null);
  const ids: Record<string, string> = {};
  for (const key of OPERATIONAL_ID_KEYS) {
    const value = sources.map((source) => source[key]).find((candidate) => typeof candidate === "string");
    if (typeof value === "string" && value.trim()) ids[key] = value;
  }
  return ids;
}

export function httpRequestLogContext(input: {
  request: {
    id: string;
    method: string;
    routeOptions: { url?: string };
    url: string;
    headers: Record<string, string | string[] | undefined>;
    params: unknown;
    query: unknown;
    body: unknown;
  };
  statusCode: number;
  durationMs: number;
  requestTime?: string;
  responseMessage?: string;
  retryAfter?: string;
}): Record<string, unknown> {
  const retryAttempt = input.request.headers["x-retry-attempt"];
  const retryStatus = input.retryAfter
    ? `retry after ${input.retryAfter}`
    : retryAttempt
      ? `attempt ${Array.isArray(retryAttempt) ? retryAttempt[0] : retryAttempt}`
      : "not retried";
  return {
    category: "HTTP",
    event: "http.request.completed",
    requestId: input.request.id,
    method: input.request.method,
    endpoint: input.request.routeOptions.url ?? input.request.url.split("?")[0],
    requestTime: input.requestTime ?? new Date().toISOString(),
    statusCode: input.statusCode,
    durationMs: Math.round(input.durationMs),
    performance: input.durationMs >= 250 ? "slow" : "normal",
    response: input.responseMessage ?? (input.statusCode < 400 ? "Request completed" : "Request failed"),
    ...operationalIds(input.request),
    retryStatus,
  };
}

function requestLogMessage(context: Record<string, unknown>): string {
  const statusCode = Number(context.statusCode);
  const parts = [
    "[HTTP]",
    context.method,
    context.endpoint,
    statusCode,
    `${context.durationMs}ms`,
  ];
  if (context.performance === "slow") parts.push("SLOW");
  if (context.campaignId) parts.push(`campaign=${context.campaignId}`);
  if (context.accountId) parts.push(`account=${context.accountId}`);
  if (context.socialAccountId) parts.push(`account=${context.socialAccountId}`);
  if (context.retryStatus !== "not retried") parts.push(`retry=${context.retryStatus}`);
  if (statusCode >= 400) {
    parts.push(`request=${context.requestId}`);
    parts.push(`error=${context.response}`);
  }
  return parts.join(" ");
}

export function installHttpErrorHandling(app: FastifyInstance): void {
  const requestStates = new WeakMap<object, RequestLogState>();

  app.addHook("onRequest", async (request, reply) => {
    requestStates.set(request, {
      startedAt: performance.now(),
      requestedAt: new Date().toISOString(),
    });
    reply.header("X-Request-Id", request.id);
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const state = requestStates.get(request);
    if (state) {
      const durationMs = performance.now() - state.startedAt;
      reply.header("X-Request-Duration-Ms", Math.round(durationMs));
      reply.header("Server-Timing", `app;dur=${durationMs.toFixed(1)}`);
    }
    reply.header("X-Retry-Status", reply.getHeader("Retry-After") ? "scheduled" : "not-retried");
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    if (request.method === "OPTIONS" && reply.statusCode < 400) return;
    const state = requestStates.get(request);
    const durationMs = state ? performance.now() - state.startedAt : 0;
    const context = httpRequestLogContext({
      request,
      statusCode: reply.statusCode,
      durationMs,
      requestTime: state?.requestedAt,
      responseMessage: state?.responseMessage,
      retryAfter: reply.getHeader("Retry-After")?.toString(),
    });
    const message = requestLogMessage(context);
    if (reply.statusCode >= 500) request.log.error(context, message);
    else if (reply.statusCode >= 400) request.log.warn(context, message);
    else request.log.info(context, message);
  });

  app.setErrorHandler((error, request, reply) => {
    const setResponseMessage = (message: string) => {
      const state = requestStates.get(request);
      if (state) state.responseMessage = message;
    };
    if (error instanceof AppError) {
      const retryAfterSeconds = error.details?.retryAfterSeconds;
      if (typeof retryAfterSeconds === "number") {
        reply.header("Retry-After", String(retryAfterSeconds));
      }
      if (error instanceof ExternalServiceError || error instanceof ExternalServiceTimeoutError) {
        request.log.error(
          { err: error, upstreamMessage: error.internalMessage },
          "Upstream request failed",
        );
        captureException(error, {
          operation: "upstream-request-failed",
          method: request.method,
          route: request.routeOptions.url,
        });
      }
      setResponseMessage(error.publicMessage ?? error.message);
      return reply.status(error.statusCode).send(
        apiErrorResponse(
          request.id,
          error.statusCode,
          error.code,
          error.publicMessage ?? error.message,
          error.details,
        ),
      );
    }

    if (error instanceof ZodError) {
      setResponseMessage("Validation failed");
      return reply
        .status(400)
        .send(apiErrorResponse(request.id, 400, "VALIDATION_ERROR", error.message));
    }

    const fastifyError = error as FastifyHttpError;
    if (fastifyError.code === "FST_ERR_VALIDATION") {
      setResponseMessage("Validation failed");
      return reply.status(400).send(
        apiErrorResponse(
          request.id,
          400,
          "VALIDATION_ERROR",
          fastifyError.message ?? "Validation failed",
        ),
      );
    }

    if (fastifyError.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
      const invalidContentType = fastifyError.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE";
      const status = invalidContentType ? 400 : fastifyError.statusCode;
      const code = status === 413
        ? "PAYLOAD_TOO_LARGE"
        : invalidContentType
          ? "INVALID_CONTENT_TYPE"
          : "BAD_REQUEST";
      const message = status === 413
        ? "Request payload is too large"
        : invalidContentType
          ? "Request content type is not supported"
          : "The request could not be processed";
      setResponseMessage(message);
      return reply.status(status).send(apiErrorResponse(request.id, status, code, message));
    }

    request.log.error(error);
    captureException(error, {
      operation: "http-request-failed",
      method: request.method,
      route: request.routeOptions.url,
    });
    setResponseMessage("Internal error");
    return reply
      .status(500)
      .send(apiErrorResponse(request.id, 500, "INTERNAL_ERROR", "Internal error"));
  });

  app.setNotFoundHandler((request, reply) => {
    const state = requestStates.get(request);
    if (state) state.responseMessage = "Route not found";
    return reply
      .status(404)
      .send(apiErrorResponse(request.id, 404, "NOT_FOUND", "Route not found"));
  });
}
