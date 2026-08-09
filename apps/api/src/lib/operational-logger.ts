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
  logger?.info({ event, ...payload });
}

export function logOperationalError(
  event: string,
  payload: Record<string, unknown>,
): void {
  logger?.error({ event, ...payload });
}
