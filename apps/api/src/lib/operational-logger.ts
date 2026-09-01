import type { FastifyBaseLogger } from "fastify";

type OperationalLogger = Pick<FastifyBaseLogger, "info" | "error">;

let logger: OperationalLogger | undefined;

export function configureOperationalLogger(appLogger: OperationalLogger): void {
  logger = appLogger;
}

export function logOperationalInfo(
  event: string,
  payload: Record<string, unknown>,
): void {
  const message = typeof payload.message === "string" ? payload.message : `[${event.toUpperCase()}] ${event}`;
  logger?.info({ event, ...payload }, message);
}

export function logOperationalError(
  event: string,
  payload: Record<string, unknown>,
): void {
  const message = typeof payload.message === "string" ? payload.message : `[${event.toUpperCase()}] ${event} failed`;
  logger?.error({ event, ...payload }, message);
}
