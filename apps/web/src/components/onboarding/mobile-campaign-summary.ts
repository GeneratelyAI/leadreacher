import type { PillData, PillSection } from "./Pill";

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
  return sections.flatMap((section): PillSection[] => {
    if (section.id === "targeting" && section.fields) {
      const count = (label: string) =>
        section.fields
          ?.find((field) => field.label === label)
          ?.value?.split(" · ")
          .filter(Boolean).length ?? 0;
      const roles = count("Decision makers"),
        locations = count("Locations");
      return [
        {
          ...section,
          label: "Audience",
          summary: [
            `${roles} ${roles === 1 ? "role" : "roles"}`,
            `${locations} ${locations === 1 ? "location" : "locations"}`,
          ].join(", "),
        },
      ];
    }
    if (section.id === "content" && section.value) {
      const [type, style, ...rest] = section.value.split(" · ");
      if (
        rest.length === 0 &&
        /^(professional|casual|aggressive)$/i.test(style ?? "")
      ) {
        return [
          { ...section, summary: type, value: type },
          {
            id: "style",
            label: "Style",
            summary: style,
            value: style,
            state: "complete",
          },
        ];
      }
    }
    return [section];
  });
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
