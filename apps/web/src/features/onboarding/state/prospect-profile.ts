import type { WebsiteScrapeStatus } from "../public/website-status";

export type ProspectProfile = NonNullable<WebsiteScrapeStatus["prospectProfile"]>;

export const EMPTY_PROFILE: ProspectProfile = {
  decisionMakers: [],
  companyTypes: [],
  industries: [],
  locations: [],
};

export const PROFILE_ROWS: Array<{ key: keyof ProspectProfile; label: string }> = [
  { key: "decisionMakers", label: "Decision makers" },
  { key: "companyTypes", label: "Company types" },
  { key: "industries", label: "Industries" },
  { key: "locations", label: "Location" },
];

export function summaryFrom(status: WebsiteScrapeStatus, profile: ProspectProfile) {
  const target = [
    profile.decisionMakers.join(", "),
    profile.companyTypes.join(", "),
    profile.locations.length ? `in ${profile.locations.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" at ");

  return {
    businessModel: status.offer || "Website-based outreach offer",
    industry: profile.industries[0] || status.market || "Business services",
    strengths: status.value || "Personalized outreach",
    idealCustomer: target || status.audience || "Qualified prospects",
    suggestedChannels: [],
    nextStep: status.strategyStatus || "Prepare a personalized outreach strategy.",
    websiteEnriched: true,
    websiteImageUrl: null,
  };
}
