import type { WebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import type { PillData, PillField, PillSection } from "@/components/onboarding/Pill";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { recoverContentChoice } from "@/lib/onboarding/content-choice";

export type SavedCampaignSummary = {
  id?: string;
  campaignType?: string;
  icpDefinition?: {
    contentChoice?: unknown;
    prospectProfile?: WebsiteScrapeStatus["prospectProfile"];
    onboarding?: { introductionSeen?: boolean; prospectsApproved?: boolean };
    approvedContent?: { type: string; style?: string; documentName?: string };
  };
  videoConfig?: { tone?: string; uploadedVideoUrl?: string; source?: string };
  channels?: { selected?: string[] };
};

/** Only persisted decisions can complete a section. Route names are not evidence. */
export function createConfirmedCampaignSummary(status: WebsiteScrapeStatus, saved: SavedCampaignSummary | null, websiteUrl?: string | null): PillData {
  const { site } = siteFrom(status, websiteUrl);
  const business = fullBusinessFields(status);
  const profile = saved?.icpDefinition?.prospectProfile;
  const approved = saved?.icpDefinition?.onboarding?.prospectsApproved
    ?? Boolean(profile && !saved?.icpDefinition?.onboarding);
  const choice = recoverContentChoice(saved ?? {});
  const content = saved?.icpDefinition?.approvedContent;
  const approvedStyle = !saved?.icpDefinition?.onboarding && (choice === "personalized-video" || choice === "ai-video")
    && ["professional", "casual", "aggressive"].includes(saved?.videoConfig?.tone ?? "");
  const contentText = content
    ? [content.type, content.style ? content.style[0].toUpperCase() + content.style.slice(1) : undefined, content.documentName].filter(Boolean).join(" · ")
    : approvedStyle ? `${choice === "ai-video" ? "AI video" : "Personalized video"} · ${saved!.videoConfig!.tone}` : "";
  const channels = saved?.channels?.selected ?? [];
  const inactive = (id: string, label: string): PillSection => ({ id, label, state: "future", pendingLabel: "Not selected" });
  return {
    fields: [], site, status: status.status === "completed" ? "ready" : "learning",
    sections: [
      status.status === "completed" && business.length
        ? { id: "business", label: "Business", state: "complete", summary: concisePhrase(status.offer, 14, 110) ?? clean(status.market), fields: business }
        : { ...inactive("business", "Business"), pendingLabel: "Awaiting website analysis" },
      approved && profile
        ? { id: "targeting", label: "Prospects", state: "complete", summary: [profile.decisionMakers[0], profile.companyTypes[0], profile.industries[0], profile.locations[0]].filter((value) => value && value.length <= 45).join(" · ") || targetingSummary(profile), fields: targetingFields(profile) }
        : inactive("targeting", "Prospects"),
      contentText ? { id: "content", label: "Content", state: "complete", summary: contentText, value: contentText } : inactive("content", "Content"),
      channels.length ? { id: "channels", label: "Channels", state: "complete", summary: channels.join(" · "), fields: [{ label: "Selected channels", value: channels.join(" · ") }] } : inactive("channels", "Channels"),
    ],
  };
}

type SemanticContent = {
  type: string;
  style?: string;
};

export type CampaignPillStage = "signup" | "discovery" | "how-it-works" | "campaign-content" | "chosen-content";

export type FutureCampaignStep = {
  id: string;
  label: string;
  statusLabel?: string;
};

type CampaignSummarySource = Pick<WebsiteScrapeStatus, "market" | "offer" | "audience" | "value" | "strategyStatus" | "prospectProfile">;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
}

function words(value: string): number {
  return clean(value).split(" ").filter(Boolean).length;
}

function concisePhrase(value: string, maxWords: number, maxCharacters: number): string | null {
  const candidates = clean(value)
    .split(/[.;:]/)
    .map(clean)
    .filter(Boolean);
  return candidates.find((candidate) => words(candidate) <= maxWords && candidate.length <= maxCharacters) ?? null;
}

function has(value: string, expression: RegExp): boolean {
  return expression.test(value);
}

function compactMarket(value: string): string {
  const source = clean(value);
  if (!source) return "";
  const direct = concisePhrase(source, 5, 34);
  if (direct) return direct;
  if (has(source, /asset management/i)) return "Digital asset management";
  if (has(source, /software|saas/i)) return "B2B software";
  if (has(source, /marketing/i)) return "Marketing services";
  if (has(source, /financial/i)) return "Financial services";
  if (has(source, /real estate/i)) return "Real estate";
  return "Business services";
}

function compactOfferParagraph(value: string): string {
  const source = clean(value);
  if (!source) return "";
  if (has(source, /lead generation|demand generation/i)) return "AI-powered lead generation with personalized outreach automation.";
  if (has(source, /data enrichment/i)) return "Data enrichment that speeds up sales-ready prospect research.";
  if (has(source, /workflow automation/i)) return "Workflow automation for efficient revenue operations.";
  if (has(source, /outreach/i)) return "Personalized outreach built for focused prospecting campaigns.";
  return "Personalized outreach for qualified prospects.";
}

function compactCustomerSegment(value: string): string | null {
  const source = clean(value).replace(/^(the|for|to)\s+/i, "");
  const role = source.match(/\b(?:[a-z]+\s+)?(?:founders?|leaders?|directors?|managers?|operators?|executives?|teams?)\b/i)?.[0];
  if (role && words(role) <= 2) return role.replace(/^\w/, (character) => character.toUpperCase());
  if (/\bvp of sales\b/i.test(source)) return "Sales leaders";
  if (/\bhead of growth\b/i.test(source)) return "Growth leaders";
  if (/\bchief marketing officer\b|\bcmo\b/i.test(source)) return "Marketing leaders";
  if (/\bchief technology officer\b|\bcto\b/i.test(source)) return "Technology leaders";
  if (/\bceo\b/i.test(source)) return "Company leaders";
  return null;
}

function customerSegments(source: CampaignSummarySource): string[] {
  const audienceSegments = clean(source.audience)
    .split(/,|\band\b|\bat\b|\bin\b/i)
    .map(compactCustomerSegment)
    .filter((value): value is string => Boolean(value));
  const profileSegments = (source.prospectProfile?.decisionMakers ?? [])
    .map(compactCustomerSegment)
    .filter((value): value is string => Boolean(value));
  const companySegments = (source.prospectProfile?.companyTypes ?? []).flatMap((value) => {
    if (/\bsaas\b/i.test(value)) return ["SaaS teams"];
    if (/mid-market/i.test(value)) return ["Mid-market teams"];
    if (/enterprise/i.test(value)) return ["Enterprise teams"];
    if (/professional services/i.test(value)) return ["Service teams"];
    return [];
  });
  const industrySegments = (source.prospectProfile?.industries ?? []).flatMap((value) => {
    const industry = compactMarket(value);
    return industry && words(industry) === 1 ? [`${industry} teams`] : [];
  });
  return [...audienceSegments, ...profileSegments, ...companySegments, ...industrySegments]
    .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 4);
}

function compactValueParagraph(value: string): string {
  const source = clean(value);
  if (!source) return "";
  if (has(source, /conversion/i) && has(source, /manual/i)) return "Higher conversion rates through precise targeting and less manual work.";
  if (has(source, /conversion/i)) return "Higher conversion rates from relevant, well-targeted outreach.";
  if (has(source, /qualified conversations/i)) return "More qualified conversations with less manual prospecting.";
  if (has(source, /data/i)) return "Reliable web data for faster, more relevant prospect research.";
  return "Relevant conversations with clearer buyer value.";
}

function compactGoalParagraph(value: string, customers: readonly string[]): string {
  const primary = customers[0]?.toLowerCase() ?? "ideal buyers";
  const secondary = customers[1]?.toLowerCase() ?? "qualified prospects";
  if (!clean(value)) return "";
  return `Position outreach for ${primary} and ${secondary} to start qualified sales conversations.`;
}

/** Builds complete, high-signal copy sized for the fixed campaign summary. */
export function createCompactCampaignFields(source: CampaignSummarySource): PillField[] {
  const customers = customerSegments(source);
  const fields: Array<PillField | null> = [
    { label: "Market", value: compactMarket(source.market) },
    { label: "Offer", value: compactOfferParagraph(source.offer) },
    customers.length ? { label: "Customers", values: customers } : null,
    { label: "Value", value: compactValueParagraph(source.value) },
    { label: "Goal", value: compactGoalParagraph(source.strategyStatus, customers) },
  ];
  return fields.filter((field): field is PillField => Boolean(field && (field.value || field.values?.length)));
}

function siteFrom(status: WebsiteScrapeStatus, websiteUrl?: string | null) {
  const profile = status.prospectProfile;
  const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
  return {
    profile,
    site: website
      ? { label: website.hostname, iconUrl: getWebsiteFaviconUrl(website.hostname) }
      : undefined,
  };
}

function fullBusinessFields(status: CampaignSummarySource): PillField[] {
  return [
    { label: "Market", value: clean(status.market) },
    { label: "Offer", value: clean(status.offer) },
    { label: "Customers", value: clean(status.audience) },
    { label: "Value", value: clean(status.value) },
    { label: "Goal", value: clean(status.strategyStatus) },
  ].filter((field) => Boolean(field.value));
}

function businessSummary(status: CampaignSummarySource): string {
  return [compactMarket(status.market), compactOfferParagraph(status.offer)]
    .filter(Boolean)
    .join(" · ");
}

function targetingFields(profile: WebsiteScrapeStatus["prospectProfile"]): PillField[] {
  if (!profile) return [];
  return [
    { label: "Decision makers", value: profile.decisionMakers.join(" · ") },
    { label: "Company types", value: profile.companyTypes.join(" · ") },
    { label: "Industries", value: profile.industries.join(" · ") },
    { label: "Locations", value: profile.locations.join(" · ") },
  ].filter((field) => Boolean(field.value));
}

function targetingSummary(profile: WebsiteScrapeStatus["prospectProfile"]): string {
  if (!profile) return "";
  const counts = [
    [profile.decisionMakers.length, "decision maker"],
    [profile.companyTypes.length, "company type"],
    [profile.industries.length, "industry"],
    [profile.locations.length, "location"],
  ] as const;

  return counts
    .filter(([count]) => count > 0)
    .map(([count, label]) => {
      const plural = count === 1
        ? label
        : label.endsWith("y")
          ? `${label.slice(0, -1)}ies`
          : `${label}s`;
      return `${count} ${plural}`;
    })
    .join(" · ");
}

function sectionSummary(fields: readonly PillField[], count = 2): string {
  return fields
    .slice(0, count)
    .map((field) => field.value ?? field.values?.join(" · ") ?? "")
    .filter(Boolean)
    .join(" · ");
}

function completedSection(
  id: PillSection["id"],
  label: string,
  fields: PillField[],
  summary?: string,
): PillSection | null {
  return fields.length
    ? { id, label, summary: summary || sectionSummary(fields), fields, state: "complete" }
    : null;
}

function pendingSection(id: PillSection["id"], label: string, pendingLabel: string): PillSection {
  return { id, label, state: "pending", pendingLabel };
}

/** Creates inactive rows for later onboarding steps without adding pill markup. */
export function createFutureCampaignSections(steps: readonly FutureCampaignStep[]): PillSection[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    state: "future",
    pendingLabel: step.statusLabel ?? "Next",
  }));
}

/** Builds the progressive campaign state for each onboarding surface. */
export function createLiveCampaignSummary(
  status: WebsiteScrapeStatus,
  stage: CampaignPillStage,
  content?: SemanticContent,
  websiteUrl?: string | null,
): PillData {
  const { profile, site } = siteFrom(status, websiteUrl);
  if (stage === "signup") {
    return {
      status: "learning",
      statusLabel: "Building your campaign",
      fields: [],
      site,
    };
  }

  if (stage === "discovery") {
    return {
      status: "ready",
      statusLabel: "Business understood",
      fields: createCompactCampaignFields(status),
      site,
    };
  }

  const business = completedSection("business", "Business", fullBusinessFields(status), businessSummary(status));
  if (!business) {
    return { status: "learning", statusLabel: "Building your campaign", fields: [], site };
  }

  const sections: PillSection[] = [business];
  if (stage === "how-it-works") {
    sections.push(pendingSection("targeting", "Targeting", "Preparing your audience"));
  }

  if (stage === "campaign-content" || stage === "chosen-content") {
    const targeting = completedSection("targeting", "Targeting", targetingFields(profile), targetingSummary(profile));
    if (targeting) sections.push(targeting);
    sections.push(
      stage === "chosen-content" && content
        ? {
            id: "content",
            label: "Content",
            value: [content.type, content.style].filter(Boolean).join(" · "),
            summary: [content.type, content.style].filter(Boolean).join(" · "),
            state: "complete",
          }
        : pendingSection("content", "Content", "Choosing content"),
    );
  }

  return {
    status: "ready",
    statusLabel: "Business understood",
    fields: [],
    sections,
    newlyCompletedSectionId: stage === "campaign-content"
      ? "targeting"
      : stage === "chosen-content" && content
        ? "content"
        : undefined,
    site,
  };
}

/** Backwards-compatible completed summary for callers outside the live flow. */
export function createSemanticCampaignSummary(
  status: WebsiteScrapeStatus,
  content?: SemanticContent,
  websiteUrl?: string | null,
): PillData {
  return createLiveCampaignSummary(status, content ? "chosen-content" : "campaign-content", content, websiteUrl);
}
