export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
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
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
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
  constructor(service: string, message: string) {
    super(`${service}: ${message}`, 502, "EXTERNAL_SERVICE_ERROR");
  }
}
