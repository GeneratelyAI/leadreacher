import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type DeliveryReservation =
  | { acquired: true; attemptId: string }
  | { acquired: false; state: string };

/**
 * Creates the durable, at-most-once reservation before an external outreach
 * request. A unique (campaignLeadId, stepIndex) constraint is the race guard.
 */
export async function acquireDeliveryReservation(
  campaignLeadId: string,
  stepIndex: number,
): Promise<DeliveryReservation> {
  try {
    const attempt = await prisma.deliveryAttempt.create({
      data: { campaignLeadId, stepIndex, state: "reserved" },
    });
    return { acquired: true, attemptId: attempt.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.deliveryAttempt.findUnique({
        where: {
          campaignLeadId_stepIndex: { campaignLeadId, stepIndex },
        },
        select: { state: true },
      });
      return { acquired: false, state: existing?.state ?? "reserved" };
    }
    throw error;
  }
}

export async function markDeliveryReservationSent(
  attemptId: string,
  providerRef?: string,
): Promise<void> {
  await prisma.deliveryAttempt.update({
    where: { id: attemptId },
    data: {
      state: "sent",
      sentAt: new Date(),
      ...(providerRef ? { providerRef } : {}),
    },
  });
}

/**
 * Network failures and crashes can occur after the provider accepted a send.
 * Such reservations are deliberately never retried automatically.
 */
export async function markDeliveryReservationUnknown(
  attemptId: string,
  providerRef?: string,
): Promise<void> {
  await prisma.deliveryAttempt.updateMany({
    where: { id: attemptId, state: "reserved" },
    data: {
      state: "unknown",
      ...(providerRef ? { providerRef } : {}),
    },
  });
}
