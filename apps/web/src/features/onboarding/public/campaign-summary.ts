/** Shared presentation contract for the canvas, summary builders, and pill. */
export type PillProps = {
  campaign: PillData;
  className?: string;
  defaultExpanded?: boolean;
  /** Keeps the shared summary compact before a phone user explicitly opens it. */
  responsiveDefaultCollapsed?: boolean;
  /** Optional creative preview, kept inside the shared collapse boundary. */
  footer?: import("react").ReactNode;
};

export type PillField = {
  label: string;
  value?: string;
  values?: string[];
};

export type PillSection = {
  id: string;
  label: string;
  summary?: string;
  value?: string;
  fields?: PillField[];
  state?: "complete" | "pending" | "future";
  pendingLabel?: string;
};

export type PillData = {
  status?: "learning" | "ready";
  statusLabel?: string;
  fields: PillField[];
  sections?: PillSection[];
  newlyCompletedSectionId?: PillSection["id"];
  site?: {
    label: string;
    iconUrl: string;
  };
};
