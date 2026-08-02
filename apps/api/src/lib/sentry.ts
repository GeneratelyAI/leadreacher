import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

let initialized = false;

export function initializeSentry(): void {
  if (initialized || !env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  });
  initialized = true;
}

type ExceptionContext = {
  operation: string;
  route?: string;
  method?: string;
  worker?: string;
  jobId?: string;
};

/** Only operational identifiers are attached; payloads and customer data stay out. */
export function captureException(
  error: unknown,
  context: ExceptionContext,
): void {
  if (!initialized) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("operation", context.operation);
    if (context.route) scope.setTag("route", context.route);
    if (context.method) scope.setTag("method", context.method);
    if (context.worker) scope.setTag("worker", context.worker);
    if (context.jobId) scope.setTag("job_id", context.jobId);
    Sentry.captureException(error);
  });
}
