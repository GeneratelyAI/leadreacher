import type { WebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import type { PillData, PillSection } from "@/components/onboarding/Pill";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";

type SemanticContent = {
  type: string;
  style?: string;
};

function sectionValue(values: readonly string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(" · ");
}

function createSection(
  id: PillSection["id"],
  label: string,
  values: readonly string[],
): PillSection | null {
  const value = values.map((entry) => entry.trim()).filter(Boolean).join("\n");
  return value ? { id, label, value } : null;
}

/**
 * Converts the stored discovery result into the completed campaign sections
 * used after Discovery. Flat Signup and Discovery summaries intentionally do
 * not use this helper.
 */
export function createSemanticCampaignSummary(
  status: WebsiteScrapeStatus,
  content?: SemanticContent,
  websiteUrl?: string | null,
): PillData {
  const profile = status.prospectProfile;
  const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
  const sections = [
    createSection("business", "Business", [status.market, status.offer]),
    createSection("targeting", "Targeting", [
      sectionValue(profile?.decisionMakers ?? []),
      sectionValue(profile?.companyTypes ?? []),
      sectionValue(profile?.industries ?? []),
      sectionValue(profile?.locations ?? []),
    ]),
    content
      ? createSection("content", "Content", [
        [content.type, content.style].filter(Boolean).join(" · "),
      ])
      : null,
  ].filter((section): section is PillSection => section !== null);

  return {
    status: sections.length > 0 ? "ready" : "learning",
    statusLabel: sections.length > 0 ? "Business understood" : "Building your campaign",
    fields: [],
    sections,
    site: website
      ? { label: website.hostname, iconUrl: getWebsiteFaviconUrl(website.hostname) }
      : undefined,
  };
}
