import type { WebsiteScrapeStatus } from "@/features/onboarding/public/website-status";
import type { PillData, PillField, PillSection } from "@/features/onboarding/public/campaign-summary";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/features/onboarding/public/website";
import { recoverContentChoice } from "@/features/onboarding/public/content-choice";

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
  messagingAngles?: { outreachMessage?: string; outreachMessageApprovedAt?: string; cta?: { label?: string; url?: string } | null };
  subscriptionStatus?: string | null;
};

/** Only persisted decisions can complete a section. Route names are not evidence. */
export function createConfirmedCampaignSummary(status: WebsiteScrapeStatus, saved: SavedCampaignSummary | null, websiteUrl?: string | null): PillData {
  const { site } = siteFrom(status, websiteUrl);
  const business = fullBusinessFields(status);
  const hasBusinessAnalysis = Boolean(clean(status.market) || clean(status.offer) || clean(status.audience) || clean(status.value));
  const profile = saved?.icpDefinition?.prospectProfile;
  const approved = saved?.icpDefinition?.onboarding?.prospectsApproved
    ?? Boolean(profile && !saved?.icpDefinition?.onboarding);
  const choice = recoverContentChoice(saved ?? {});
  const content = saved?.icpDefinition?.approvedContent;
  const approvedStyle = !saved?.icpDefinition?.onboarding && (choice === "personalized-video" || choice === "ai-video")
    && ["professional", "casual", "aggressive"].includes(saved?.videoConfig?.tone ?? "");
  const contentType = content?.type ?? (approvedStyle ? choice === "ai-video" ? "AI video" : "Personalized video" : "");
  const contentStyle = content?.style ?? (approvedStyle ? saved?.videoConfig?.tone : undefined);
  const channels = saved?.channels?.selected ?? [];
  const channelLabels = channels.map((channel) => channel === "email" ? "Gmail" : channel);
  const message = saved?.messagingAngles?.outreachMessage?.trim();
  const messageApproved = Boolean(message && saved?.messagingAngles?.outreachMessageApprovedAt);
  const cta = saved?.messagingAngles?.cta;
  const subscriptionActive = saved?.subscriptionStatus === "active" || saved?.subscriptionStatus === "trialing";
  const inactive = (id: string, label: string): PillSection => ({ id, label, state: "future", pendingLabel: "Not selected" });
  return {
    fields: [], site, status: status.status === "completed" ? "ready" : "learning",
    sections: [
      status.status === "completed" && hasBusinessAnalysis && business.length
        ? { id: "business", label: "Business", state: "complete", summary: businessBrief(status), fields: business }
        : { ...inactive("business", "Business"), pendingLabel: "Campaign details are being prepared" },
      approved && profile
        ? { id: "targeting", label: "Prospects", state: "complete", summary: prospectsBrief(profile), fields: targetingFields(profile) }
        : { ...inactive("targeting", "Prospects"), pendingLabel: "Campaign details are being prepared" },
      contentType ? { id: "content", label: "Content", state: "complete", summary: contentBrief(contentType, contentStyle, content?.documentName), fields: contentFields(contentType, contentStyle, content?.documentName) } : inactive("content", "Content"),
      messageApproved ? { id: "message", label: "Message", state: "complete", summary: messageBrief(cta?.label, message), fields: [
        { label: "Message", value: message },
        ...(cta?.label ? [{ label: "Call to action", value: cta.label }] : []),
        ...(cta?.url ? [{ label: "Destination", value: cta.url }] : []),
      ] } : { ...inactive("message", "Message"), pendingLabel: message ? "Awaiting approval" : "Not generated" },
      channels.length ? { id: "channels", label: "Channels", state: "complete", summary: channelLabels.join(" · "), fields: [{ label: "Selected channels", values: channelLabels }] } : inactive("channels", "Channels"),
      subscriptionActive ? {
        id: "subscription",
        label: "Subscription",
        state: "complete",
        summary: saved?.subscriptionStatus === "trialing" ? "Trial is active." : "Subscription is active.",
        fields: [
          { label: "Status", value: saved?.subscriptionStatus === "trialing" ? "Trial active" : "Active" },
          { label: "Next step", value: "Connect delivery channels" },
        ],
      } : { ...inactive("subscription", "Subscription"), pendingLabel: "Choose a subscription to continue" },
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

function sentence(value: string): string {
  const normalized = clean(value);
  if (!normalized) return "Campaign details are being prepared.";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function lowerFirst(value: string): string {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function briefValue(value: string, maxWords: number, maxCharacters: number): string {
  return concisePhrase(value, maxWords, maxCharacters) ?? "";
}

function businessBrief(source: CampaignSummarySource): string {
  const offer = briefValue(source.offer, 10, 76);
  const value = briefValue(source.value, 10, 76);
  if (offer && value) return sentence(`${offer} for ${lowerFirst(value)}`);
  return sentence(offer || value || briefValue(source.market, 9, 70));
}

function companyPhrase(value: string): string {
  const normalized = clean(value);
  if (!normalized) return "";
  return /\b(compan(?:y|ies)|teams?|business(?:es)?|firms?|organizations?)\b/i.test(normalized)
    ? normalized
    : `${normalized} companies`;
}

function prospectsBrief(profile: WebsiteScrapeStatus["prospectProfile"]): string {
  if (!profile) return "Campaign details are being prepared.";
  const role = briefValue(profile.decisionMakers[0] ?? "", 5, 48);
  const companyType = companyPhrase(briefValue(profile.companyTypes[0] ?? "", 5, 48));
  const industry = briefValue(profile.industries[0] ?? "", 5, 42);
  const location = briefValue(profile.locations[0] ?? "", 5, 42);
  const audience = [role, companyType ? `at ${companyType}` : ""].filter(Boolean).join(" ");
  if (!audience && !industry && !location) return "Campaign details are being prepared.";
  return sentence(`Reaches ${audience || "priority prospects"}${industry ? ` in ${industry}` : ""}${location ? ` across ${location}` : ""}`);
}

function contentBrief(type: string, style?: string, documentName?: string): string {
  const format = clean(type);
  if (!format) return "Campaign details are being prepared.";
  const tone = clean(style ?? "");
  const asset = clean(documentName ?? "");
  if (format.toLowerCase() === "document" && asset) return sentence(`${format}: ${asset}`);
  return sentence(tone ? `${format} in a ${lowerFirst(tone)} style` : `${format} selected`);
}

function contentFields(type: string, style?: string, documentName?: string): PillField[] {
  const format = clean(type);
  const tone = clean(style ?? "");
  const name = clean(documentName ?? "");
  const fields: Array<PillField | null> = [
    format ? { label: "Format", value: format } : null,
    tone ? { label: "Style", value: tone } : null,
    name ? { label: "Asset", value: name } : null,
  ];
  return fields.filter((field): field is PillField => Boolean(field));
}

function messageBrief(ctaLabel?: string, message?: string): string {
  const cta = clean(ctaLabel ?? "");
  if (cta) return sentence(`Invites prospects to ${lowerFirst(cta)}`);
  if (clean(message ?? "")) return "Approved outreach message.";
  return "Campaign details are being prepared.";
}

/** Converts transient UI selections into the same concise voice used by persisted campaign data. */
export function presentCampaignSectionSummary(section: Pick<PillSection, "id" | "summary" | "value">): string | undefined {
  const summary = clean(section.summary ?? "");
  if (!summary) return undefined;
  if (["business", "targeting", "message", "subscription"].includes(section.id)) return sentence(summary);
  if (section.id !== "content") return summary;
  if (/\bin a .+ style$/i.test(summary) || / selected$/i.test(summary)) return sentence(summary);
  const [type, ...details] = clean(section.value ?? summary).split(" · ").map(clean);
  return clean(type).toLowerCase() === "document"
    ? contentBrief(type, undefined, details.join(" · "))
    : contentBrief(type, details[0]);
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
  return businessBrief(status);
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
  return prospectsBrief(profile);
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
    sections.push(pendingSection("targeting", "Prospects", "Preparing your audience"));
  }

  if (stage === "campaign-content" || stage === "chosen-content") {
    const targeting = completedSection("targeting", "Prospects", targetingFields(profile), targetingSummary(profile));
    if (targeting) sections.push(targeting);
    sections.push(
      stage === "chosen-content" && content
        ? {
            id: "content",
            label: "Content",
            value: [content.type, content.style].filter(Boolean).join(" · "),
            summary: contentBrief(content.type, content.style),
            fields: contentFields(content.type, content.style),
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
