export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly publicMessage?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: Record<string, unknown>,
    publicMessage?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.publicMessage = publicMessage;
  }
}

export type ApiErrorResponse = {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};

export function apiErrorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    status,
    code,
    message,
    requestId,
    ...(details ? { details } : {}),
  };
}

export class AuthError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class UnauthorizedError extends AuthError {}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class DailySendLimitError extends AppError {
  constructor(readonly resetAt: string) {
    super(
      `Daily LinkedIn message limit reached. Sending resets at ${resetAt}.`,
      429,
      "daily_message_limit",
      { resetAt },
    );
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(message: string = "An active subscription is required to run outreach") {
    super(message, 402, "subscription_required");
  }
}

export class OrganizationDisabledError extends AppError {
  constructor() {
    super(
      "This organization is pending deletion. Recover it before continuing.",
      423,
      "organization_disabled",
    );
  }
}

export class DeliveryPendingError extends AppError {
  constructor() {
    super("This reply is still being delivered", 409, "delivery_pending");
  }
}

export class DeliveryUnknownError extends AppError {
  constructor() {
    super(
      "Delivery could not be confirmed. Review the conversation before trying again.",
      409,
      "delivery_unknown",
    );
  }
}

export class DeliveryFailedError extends AppError {
  constructor() {
    super("The previous delivery failed. Send again to create a new attempt.", 409, "delivery_failed");
  }
}

export class ExternalServiceError extends AppError {
  readonly internalMessage: string;

  constructor(
    readonly service: string,
    message: string,
    statusCode: number = 502,
    code: string = "EXTERNAL_SERVICE_ERROR",
    publicMessage: string = `${service} request failed`,
  ) {
    super(`${service}: ${message}`, statusCode, code, { service }, publicMessage);
    this.internalMessage = message;
  }
}

export class ExternalServiceTimeoutError extends ExternalServiceError {
  constructor(service: string, message: string = "The upstream service timed out") {
    super(
      service,
      message,
      504,
      "EXTERNAL_SERVICE_TIMEOUT",
      `${service} request timed out`,
    );
  }
}

export class GoneError extends AppError {
  constructor(message: string) {
    super(message, 410, "GONE");
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

export function externalServiceFailure(service: string, error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  const timedOut =
    (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) ||
    /\b(?:timed?\s*out|timeout)\b/i.test(message);
  return timedOut
    ? new ExternalServiceTimeoutError(service, message)
    : new ExternalServiceError(service, message);
}
