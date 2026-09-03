import { z } from "zod";

/** Lead.status values (String column - not a Prisma enum). */
const LEAD_STATUS_VALUES = [
  "new",
  "contacted",
  "connected",
  "replied",
  "meeting",
  "converted",
  "lost",
  "skipped",
] as const;

export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number];

export const LeadStatusSchema = z.enum(LEAD_STATUS_VALUES);

export const LEAD_STATUS_CONTACTED = "contacted";
export const LEAD_STATUS_CONNECTED = "connected";
