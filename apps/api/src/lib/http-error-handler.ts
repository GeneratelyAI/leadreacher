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

export function installHttpErrorHandling(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
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
      return reply
        .status(400)
        .send(apiErrorResponse(request.id, 400, "VALIDATION_ERROR", error.message));
    }

    const fastifyError = error as FastifyHttpError;
    if (fastifyError.code === "FST_ERR_VALIDATION") {
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
      return reply.status(status).send(apiErrorResponse(request.id, status, code, message));
    }

    request.log.error(error);
    captureException(error, {
      operation: "http-request-failed",
      method: request.method,
      route: request.routeOptions.url,
    });
    return reply
      .status(500)
      .send(apiErrorResponse(request.id, 500, "INTERNAL_ERROR", "Internal error"));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(apiErrorResponse(request.id, 404, "NOT_FOUND", "Route not found"));
  });
}
