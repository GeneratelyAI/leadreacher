import type { Lead } from "@prisma/client";
import { whatsappAttendeeId, type OutreachChannel } from "../lib/channels.js";
import { normalizePhoneE164, phoneDigits } from "../lib/phone.js";

export function resolveLeadAttendeeId(
  channel: OutreachChannel,
  lead: Pick<
    Lead,
    | "email"
    | "phone"
    | "providerLinkedinId"
    | "providerWhatsappId"
    | "providerFacebookId"
    | "providerInstagramId"
  >,
): string | null {
  switch (channel) {
    case "linkedin":
      return lead.providerLinkedinId?.trim() || null;
    case "whatsapp": {
      if (lead.providerWhatsappId?.trim()) return lead.providerWhatsappId.trim();
      const phone = normalizePhoneE164(lead.phone) ?? lead.phone;
      if (!phone) return null;
      return whatsappAttendeeId(phoneDigits(phone) ?? phone);
    }
    case "facebook":
      return lead.providerFacebookId?.trim() || null;
    case "instagram":
      return lead.providerInstagramId?.trim() || null;
    case "email":
      return lead.email?.trim().toLowerCase() || null;
    default:
      return null;
  }
}

export function emailThreadKey(unipileAccountId: string, email: string): string {
  return `${unipileAccountId}:${email.trim().toLowerCase()}`;
}
