import type { Lead } from "@prisma/client";
import { normalizePhoneE164 } from "../lib/phone.js";

export type WhatsAppReachability = {
  total: number;
  reachable: number;
  invalidPhone: number;
  missingConsent: number;
  suppressed: number;
};

export function getWhatsAppReachability(leads: Array<Pick<Lead,
  "phone" | "whatsappConsentAt" | "whatsappConsentSource" | "outreachSuppressedAt"
>>): WhatsAppReachability {
  const result: WhatsAppReachability = {
    total: leads.length,
    reachable: 0,
    invalidPhone: 0,
    missingConsent: 0,
    suppressed: 0,
  };
  for (const lead of leads) {
    if (lead.outreachSuppressedAt) result.suppressed += 1;
    else if (!normalizePhoneE164(lead.phone)) result.invalidPhone += 1;
    else if (!lead.whatsappConsentAt || !lead.whatsappConsentSource?.trim()) result.missingConsent += 1;
    else result.reachable += 1;
  }
  return result;
}
