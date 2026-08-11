import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Deterministic primary key for an inbound message, derived from the provider's
 * `message_id`. Two webhook deliveries of the same message therefore map to the
 * same row id, so a duplicate/concurrent delivery hits the PK unique constraint
 * instead of double-inserting. Scoped to inbound because outbound `externalId`s
 * (provider_id, chat_id) are legitimately reused across campaigns.
 */
export function inboundMessageId(messageId: string): string {
  return `inbound:${messageId}`;
}

type InboundMessageData = Prisma.MessageUncheckedCreateInput & {
  externalId: string;
};

/** Prisma "unique constraint failed" - duck-typed to avoid client class-identity pitfalls. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Idempotently record an inbound message. Returns `{ created: false }` when the
 * message was already stored (P2002 on the deterministic id), so concurrent
 * webhook re-deliveries are race-safe at the DB level. Re-throws other errors.
 */
export async function recordInboundMessage(
  data: InboundMessageData,
): Promise<{ created: boolean }> {
  try {
    await prisma.message.create({
      data: { ...data, id: inboundMessageId(data.externalId) },
    });
    return { created: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { created: false };
    }
    throw error;
  }
}
