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

/** Wire shape, not validation: legacy reads and drafts can contain other types. */
export type SequenceStep = {
  type: string;
  message: string;
  delayHours: number;
  subject?: string;
};
