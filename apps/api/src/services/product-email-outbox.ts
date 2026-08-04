import { Resend } from "resend";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

type EnqueueProductEmailInput = {
  orgId: string;
  idempotencyKey: string;
  template: string;
  recipient: string;
  subject: string;
  text: string;
};

export async function enqueueProductEmail(input: EnqueueProductEmailInput) {
  return prisma.productEmailOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      orgId: input.orgId,
      idempotencyKey: input.idempotencyKey,
      template: input.template,
      recipient: input.recipient,
      subject: input.subject,
      payload: { text: input.text },
    },
    update: {},
  });
}

export async function enqueueOrganizationEmail(input: Omit<EnqueueProductEmailInput, "recipient">) {
  const owner = await prisma.user.findFirst({
    where: { orgId: input.orgId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  if (!owner?.email) return null;
  return enqueueProductEmail({ ...input, recipient: owner.email });
}

function emailText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("text" in payload)) return "";
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

export async function processProductEmailOutbox(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  if (!env.RESEND_API_KEY) return { processed: 0, sent: 0, failed: 0 };
  const resend = new Resend(env.RESEND_API_KEY);
  const rows = await prisma.productEmailOutbox.findMany({
    where: { status: { in: ["pending", "failed"] }, scheduledAt: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const claimed = await prisma.productEmailOutbox.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: { status: "sending", attempts: { increment: 1 }, lastError: null },
    });
    if (!claimed.count) continue;

    try {
      const result = await resend.emails.send({
        from: env.PRODUCT_EMAIL_FROM,
        to: row.recipient,
        replyTo: env.SUPPORT_EMAIL,
        subject: row.subject,
        text: emailText(row.payload),
      });
      if (result.error) throw new Error(result.error.message);
      await prisma.productEmailOutbox.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      await prisma.productEmailOutbox.update({
        where: { id: row.id },
        data: {
          status: "failed",
          scheduledAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
          lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
        },
      });
      failed += 1;
    }
  }

  return { processed: sent + failed, sent, failed };
}
