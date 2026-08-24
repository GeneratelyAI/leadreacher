import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Deterministic primary key for an inbound message, derived from the provider's
 * message ID. Concurrent webhook deliveries therefore contend on one row
 * instead of creating duplicate messages.
 */
export function inboundMessageId(messageId: string): string {
  return `inbound:${messageId}`;
}

export type InboundMessageData = Prisma.MessageUncheckedCreateInput & {
  externalId: string;
};

type InboundMessageStore = Pick<PrismaClient, "message">;

/** Prisma "unique constraint failed" - duck-typed for client-version safety. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Idempotently record an inbound message against the supplied durable store.
 * The injectable store lets production use the shared Prisma client while
 * integration tests prove the same behavior against a real database.
 */
export async function recordInboundMessageWithStore(
  store: InboundMessageStore,
  data: InboundMessageData,
): Promise<{ created: boolean }> {
  try {
    await store.message.create({
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
