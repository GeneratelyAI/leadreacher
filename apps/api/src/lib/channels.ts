import { OUTREACH_CHANNELS, SEQUENCE_STEP_TYPES, type OutreachChannel, type SequenceStepType } from "@leadreacher/shared/delivery";
export { OUTREACH_CHANNELS, SEQUENCE_STEP_TYPES, type OutreachChannel, type SequenceStepType } from "@leadreacher/shared/delivery";

/** Unipile hosted-auth provider tokens we pass to createHostedAuthLink. */
export const UNIPILE_CONNECT_PROVIDERS = [
  "LINKEDIN",
  "WHATSAPP",
  "MESSENGER",
  "INSTAGRAM",
  "GOOGLE",
  "OUTLOOK",
  "MAIL",
] as const;

const STEP_CHANNEL: Record<SequenceStepType, OutreachChannel> = {
  linkedin_invite: "linkedin",
  linkedin_message: "linkedin",
  whatsapp_message: "whatsapp",
  facebook_message: "facebook",
  instagram_message: "instagram",
  email: "email",
};

export function isOutreachChannel(value: string): value is OutreachChannel {
  return (OUTREACH_CHANNELS as readonly string[]).includes(value);
}

export function isSequenceStepType(value: string): value is SequenceStepType {
  return (SEQUENCE_STEP_TYPES as readonly string[]).includes(value);
}

export function channelForStepType(type: string): OutreachChannel | null {
  if (!isSequenceStepType(type)) return null;
  return STEP_CHANNEL[type];
}

/**
 * Map Unipile account.type / hosted-auth provider to our SocialAccount.platform.
 */
export function normalizeUnipilePlatform(raw: string): OutreachChannel | string {
  const value = raw.trim().toLowerCase();
  if (value === "messenger" || value === "facebook") return "facebook";
  if (
    value === "google" ||
    value === "outlook" ||
    value === "microsoft" ||
    value === "imap" ||
    value === "mail"
  ) {
    return "email";
  }
  if (isOutreachChannel(value)) return value;
  return value;
}

/** WhatsApp Unipile attendee id from an E.164-ish phone. */
export function whatsappAttendeeId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@s.whatsapp.net`;
}
