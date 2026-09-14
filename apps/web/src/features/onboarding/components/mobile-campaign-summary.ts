import type { PillData, PillSection } from "@/features/onboarding/public/campaign-summary";

/** Presentation only: every detail still comes from the shared, saved summary. */
export function mobileCampaignSections(campaign: PillData): PillSection[] {
  const sections = campaign.sections?.length
    ? campaign.sections
    : campaign.fields.length
      ? [
          {
            id: "business",
            label: "Business",
            summary: campaign.statusLabel,
            fields: campaign.fields,
          },
        ]
      : [];
  return sections;
}

export function shortSavedCustomerSegments(value: string) {
  const segments = value
    .split(/,|\band\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length &&
    segments.every((segment) => segment.split(/\s+/).length <= 2)
    ? segments
    : null;
}
