/** Outreach channels supported end-to-end via Unipile. */
export const OUTREACH_CHANNELS = [
  "linkedin",
  "whatsapp",
  "facebook",
  "instagram",
  "email",
] as const;

export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const SEQUENCE_STEP_TYPES = [
  "linkedin_invite",
  "linkedin_message",
  "whatsapp_message",
  "facebook_message",
  "instagram_message",
  "email",
] as const;

export type SequenceStepType = (typeof SEQUENCE_STEP_TYPES)[number];

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

export type UnipileConnectProvider = (typeof UNIPILE_CONNECT_PROVIDERS)[number];

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

export function connectProviderForPlatform(platform: string): UnipileConnectProvider {
  switch (normalizeUnipilePlatform(platform)) {
    case "whatsapp":
      return "WHATSAPP";
    case "facebook":
      return "MESSENGER";
    case "instagram":
      return "INSTAGRAM";
    case "email":
      return "GOOGLE";
    default:
      return "LINKEDIN";
  }
}

/** WhatsApp Unipile attendee id from an E.164-ish phone. */
export function whatsappAttendeeId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@s.whatsapp.net`;
}
