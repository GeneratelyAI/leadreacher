import { setDiscoveryOrgScope } from "@/features/onboarding/public/discovery-cache";
import {
  demoReducer,
  readDemoState,
  writeDemoState,
  type DemoCampaignType,
} from "@/features/onboarding/public/demo-store";

const PREVIEW_ORG_ID = "onboarding-preview-org";
const DEMO_ACCOUNTS_KEY = "lr_demo_connected_accounts_v1";

type FixtureAccount = {
  id: string;
  platform: string;
  providerType: string;
  accountName: string;
  avatarUrl: null;
  status: "active";
};

const DEFAULT_LINKEDIN_ACCOUNT: FixtureAccount = {
  id: "preview-linkedin",
  platform: "linkedin",
  providerType: "linkedin",
  accountName: "Alex Morgan",
  avatarUrl: null,
  status: "active",
};

const PREVIEW_OUTREACH_MESSAGE = "Hi {{FirstName}}, I noticed {{Company}} is growing its sales motion. LeadReacher helps teams find the right buyers and start relevant conversations with personalized outreach. Would it be useful to compare your current process with a campaign built around your audience?";

export function isOnboardingPreview(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/onboarding-preview");
}

export function isOnboardingDemo(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/demo/onboarding");
}

function fixtureScope(): string {
  return isOnboardingDemo() ? "/demo/onboarding" : "/onboarding-preview";
}

export function usesOnboardingFixtures(): boolean {
  return isOnboardingPreview() || isOnboardingDemo();
}

export function fixtureWebsiteUrl(): string {
  if (typeof window === "undefined") return "https://acme.example";
  setDiscoveryOrgScope(PREVIEW_ORG_ID);
  if (!isOnboardingDemo()) return "https://acme.example";

  try {
    const stored = window.sessionStorage.getItem("lr_demo_onboarding_v1");
    const parsed = stored ? JSON.parse(stored) as { website?: unknown } : null;
    return typeof parsed?.website === "string" && parsed.website.trim()
      ? parsed.website
      : "https://acme.example";
  } catch {
    return "https://acme.example";
  }
}

const initialStrategy = {
  id: "onboarding-preview-strategy",
  orgId: PREVIEW_ORG_ID,
  campaignType: "personalized_outreach",
  videoConfig: {
    enabled: true,
    mode: "personalized",
    source: "generated",
    tone: "professional",
    uploadedVideoUrl: null,
  },
  icpDefinition: {
    onboarding: { introductionSeen: false, prospectsApproved: false },
    idealCustomer: "Growth-stage B2B companies with lean sales teams",
    audienceAnalysis: {
      status: "completed",
      source: "connected_linkedin",
      companies: { status: "available", totalFound: 1248, sampleSize: 180 },
      decisionMakers: { totalFound: 682, sampleSize: 180 },
      reachability: { percentage: 86, reachableProfiles: 155, totalProfiles: 180 },
      topIndustries: [
        { industry: "Software", count: 68, percentage: 38 },
        { industry: "Marketing", count: 47, percentage: 26 },
        { industry: "Professional services", count: 34, percentage: 19 },
      ],
      topBuyerPersonas: [
        { title: "Head of Growth", count: 54 },
        { title: "VP of Sales", count: 42 },
        { title: "Founder", count: 31 },
      ],
    },
    strategyBrief: {
      status: "ready",
      goal: "Start qualified sales conversations",
      market: "North American growth-stage B2B companies",
      audience: "Founders and revenue leaders at teams of 10–200 people",
      offer: "Personalized multi-channel outreach",
      valueProposition: "Book more qualified conversations without adding manual prospecting work.",
      decisionMakerRoles: ["Founder", "VP of Sales", "Head of Growth"],
      outreachAngles: [
        {
          title: "Remove manual prospecting",
          description: "Lead with the time saved by a coordinated acquisition workflow.",
          opener: "Your team can reach qualified buyers without building another manual process.",
        },
        {
          title: "Increase reply quality",
          description: "Show how research-led personalization creates more relevant conversations.",
          opener: "We found a practical way to make each first touch more relevant.",
        },
      ],
      executionPlan: [
        { step: 1, title: "Build the audience", description: "Find companies and roles matching the ICP." },
        { step: 2, title: "Prepare outreach", description: "Generate personalized messages and video." },
        { step: 3, title: "Review and launch", description: "Approve the sequence before delivery." },
      ],
      audienceSample: {
        decisionMakers: 180,
        topBuyerPersonas: ["Head of Growth", "VP of Sales", "Founder"],
      },
    },
  },
  channels: {
    selected: [] as string[],
    recommendations: [
      { channel: "linkedin", label: "LinkedIn", confidence: 92, signalCount: 155, totalProfiles: 180, tag: "Best fit", description: "Most decision makers are reachable here." },
      { channel: "email", label: "Email", confidence: 84, signalCount: 142, totalProfiles: 180, tag: "Strong coverage", description: "Reliable reach for follow-up sequences." },
      { channel: "whatsapp", label: "WhatsApp", confidence: 61, signalCount: 74, totalProfiles: 180, tag: "Selective", description: "Useful where consent and mobile data are available." },
    ],
  },
  messagingAngles: {
    outreachMessage: PREVIEW_OUTREACH_MESSAGE as string | null,
    outreachMessageApprovedAt: null as string | null,
    cta: {
      label: "Book a quick call",
      url: "https://example.com/demo",
    } as { label: string; url: string } | null,
  },
  updatedAt: new Date(0).toISOString(),
};

const scrapeStatus = {
  status: "completed",
  url: "https://acme.example",
  market: "B2B revenue teams",
  offer: "Automated personalized outreach",
  audience: "Founders, sales leaders, and growth teams",
  value: "More qualified conversations with less manual work",
  strategyStatus: "ready",
  prospectProfile: {
    decisionMakers: ["Founder", "VP of Sales", "Head of Growth"],
    companyTypes: ["B2B SaaS", "Professional services", "Marketing agencies"],
    industries: ["Technology", "Consulting", "Financial services"],
    locations: ["Canada", "United States"],
  },
  error: null,
};

/** Reset only preview-owned storage, never authenticated campaign data. */
export function seedMobileReference(screen: string) {
  if (!isOnboardingPreview()) return;
  if (window.sessionStorage.getItem("lr_mobile_reference_screen") === screen) return;
  const status = structuredClone(scrapeStatus);
  Object.assign(status, { market: "B2B software", audience: "Founders and sales teams", value: "More qualified conversations", strategyStatus: "Book more relevant sales meetings" });
  status.prospectProfile.companyTypes = ["B2B SaaS", "Services", "Agencies"];
  status.prospectProfile.industries = ["Technology", "Consulting", "Finance"];
  if (screen === "06") status.prospectProfile.decisionMakers.push("Marketing Director", "Operations Manager", "Revenue Leader");
  const strategy = structuredClone(initialStrategy);
  strategy.channels.selected = ["linkedin", "gmail"];
  Object.assign(strategy.icpDefinition, {
    websiteUrl: status.url,
    discoverySummary: status,
    prospectProfile: status.prospectProfile,
    contentChoice: screen === "10" ? "ai-video" : screen === "11" ? "your-video" : screen === "12" ? "document" : "personalized-video",
    approvedContent: Number(screen) >= 13 ? { type: "Personalized video", style: "professional" } : undefined,
    onboarding: { introductionSeen: Number(screen) >= 5, prospectsApproved: Number(screen) >= 8 },
  });
  if (screen === "10") { strategy.campaignType = "ai_video_ad"; strategy.videoConfig.tone = "casual"; }
  window.sessionStorage.setItem("lr_mobile_reference_scrape", JSON.stringify(status));
  window.sessionStorage.setItem("lr_mobile_reference_screen", screen);
  window.sessionStorage.setItem("lr_fixture_strategy:/onboarding-preview", JSON.stringify(strategy));
  window.sessionStorage.removeItem("lr_fixture_content_choice:/onboarding-preview");
  window.sessionStorage.removeItem(`lr_prospect_review:${PREVIEW_ORG_ID}:${status.url}`);
  if (screen === "16") {
    window.sessionStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify([
      DEFAULT_LINKEDIN_ACCOUNT,
      { id: "preview-email", platform: "email", providerType: "google", accountName: "alex@example.com", avatarUrl: null, status: "active" },
    ]));
  } else {
    window.sessionStorage.removeItem(DEMO_ACCOUNTS_KEY);
  }
}

function fixtureScrapeStatus() {
  if (isOnboardingPreview()) {
    try {
      const saved = window.sessionStorage.getItem("lr_mobile_reference_scrape");
      if (saved) return JSON.parse(saved) as typeof scrapeStatus;
    } catch { /* Preview data may be reset when browser storage is unavailable. */ }
  }
  return scrapeStatus;
}

/** Read the already seeded visual fixture without mutating organization scope. */
export function mobileReferenceWebsiteUrl(): string | undefined {
  return isOnboardingPreview() ? fixtureScrapeStatus().url : undefined;
}

function parseRequestBody(options: RequestInit): Record<string, unknown> {
  if (typeof options.body !== "string") return {};
  try {
    const value = JSON.parse(options.body) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function rememberDemoCampaignType(value: unknown): void {
  if (!isOnboardingDemo()) return;
  if (value !== "personalized_outreach" && value !== "ai_video_ad" && value !== "uploaded_video") return;
  const current = readDemoState(window.sessionStorage);
  if (!current) return;
  const next = demoReducer(current, {
    type: "select-campaign",
    campaignType: value as DemoCampaignType,
  });
  writeDemoState(window.sessionStorage, next);
}

function rememberDemoTone(value: unknown): void {
  if (!isOnboardingDemo()) return;
  if (value !== "professional" && value !== "casual" && value !== "aggressive") return;
  const current = readDemoState(window.sessionStorage);
  if (!current) return;
  writeDemoState(window.sessionStorage, demoReducer(current, {
    type: "select-tone",
    tone: value === "casual" ? "friendly" : value === "aggressive" ? "direct" : "professional",
  }));
}

function readDemoAccounts(): FixtureAccount[] {
  if (!usesOnboardingFixtures()) return [DEFAULT_LINKEDIN_ACCOUNT];
  try {
    const stored = window.sessionStorage.getItem(DEMO_ACCOUNTS_KEY);
    if (!stored) return [DEFAULT_LINKEDIN_ACCOUNT];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed as FixtureAccount[] : [DEFAULT_LINKEDIN_ACCOUNT];
  } catch {
    return [DEFAULT_LINKEDIN_ACCOUNT];
  }
}

function connectDemoAccount(provider: unknown): FixtureAccount {
  const definitions: Record<string, Omit<FixtureAccount, "id">> = {
    LINKEDIN: { platform: "linkedin", providerType: "linkedin", accountName: "Demo LinkedIn account", avatarUrl: null, status: "active" },
    WHATSAPP: { platform: "whatsapp", providerType: "whatsapp", accountName: "Demo WhatsApp account", avatarUrl: null, status: "active" },
    INSTAGRAM: { platform: "instagram", providerType: "instagram", accountName: "Demo Instagram account", avatarUrl: null, status: "active" },
    MESSENGER: { platform: "facebook", providerType: "messenger", accountName: "Demo Messenger account", avatarUrl: null, status: "active" },
    GOOGLE: { platform: "email", providerType: "google", accountName: "demo@gmail.com", avatarUrl: null, status: "active" },
    OUTLOOK: { platform: "email", providerType: "outlook", accountName: "demo@outlook.com", avatarUrl: null, status: "active" },
  };
  const key = typeof provider === "string" ? provider : "LINKEDIN";
  const definition = definitions[key] ?? definitions.LINKEDIN;
  const accounts = readDemoAccounts();
  const account = { ...definition, id: `demo-${key.toLowerCase()}-${accounts.length + 1}` };
  window.sessionStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
  return account;
}

/** Deterministic, side-effect-free API responses for the visual onboarding preview. */
export async function previewApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!usesOnboardingFixtures()) throw new Error("Preview fixtures are unavailable outside preview routes.");
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
  const method = (options.method ?? "GET").toUpperCase();
  const strategyKey = `lr_fixture_strategy:${fixtureScope()}`;
  const strategy = structuredClone(initialStrategy);
  try {
    const saved = window.sessionStorage.getItem(strategyKey);
    if (saved) Object.assign(strategy, JSON.parse(saved));
  } catch { /* Use the shared fixture when storage is unavailable. */ }
  const saveStrategy = () => {
    try { window.sessionStorage.setItem(strategyKey, JSON.stringify(strategy)); } catch { /* Optional fixture persistence. */ }
  };
  const savedChoiceKey = `lr_fixture_content_choice:${fixtureScope()}`;
  try {
    const savedChoice = window.sessionStorage.getItem(savedChoiceKey);
    if (savedChoice) Object.assign(strategy.icpDefinition, { contentChoice: savedChoice });
  } catch { /* Fixtures remain usable when browser storage is unavailable. */ }
  const namedRoute = window.location.pathname
    .replace(/^\/onboarding-preview/, "")
    .replace(/^\/demo\/onboarding/, "");
  const routeNeedsContent = ["/cta", "/channels", "/checkout", "/connect-channels"].includes(namedRoute);
  if (routeNeedsContent) {
    const definition = strategy.icpDefinition as typeof strategy.icpDefinition & {
      contentChoice?: string;
      approvedContent?: { type: string; style: string | null };
    };
    Object.assign(strategy.icpDefinition, {
      contentChoice: definition.contentChoice ?? "personalized-video",
      approvedContent: definition.approvedContent ?? { type: "Personalized video", style: strategy.videoConfig.tone },
      onboarding: { introductionSeen: true, prospectsApproved: true },
    });
  }
  if (["/channels", "/checkout", "/connect-channels"].includes(namedRoute)) {
    strategy.messagingAngles.outreachMessageApprovedAt ??= new Date(0).toISOString();
  }
  if (["/checkout", "/connect-channels"].includes(namedRoute) && strategy.channels.selected.length === 0) {
    strategy.channels.selected = ["linkedin", "gmail"];
  }

  if (path === "/auth/bootstrap") {
    return {
      orgId: PREVIEW_ORG_ID,
      userId: "onboarding-preview-user",
      subscriptionStatus: null,
      onboardedAt: null,
      activeChannelCount: 1,
      scrapeStatus: fixtureScrapeStatus(),
    } as T;
  }
  if (path === "/discovery/scrape-status" || path === "/discovery/scrape") return fixtureScrapeStatus() as T;
  if (path === "/discovery/summary") {
    return {
      company: "Acme Growth",
      market: scrapeStatus.market,
      offer: scrapeStatus.offer,
      audience: scrapeStatus.audience,
      value: scrapeStatus.value,
      strengths: "Personalized outreach that stays reviewable and coordinated.",
      nextStep: "Build a focused acquisition strategy.",
    } as T;
  }
  if (path === "/discovery/complete") {
    const body = parseRequestBody(options);
    const existingProfile = (strategy.icpDefinition as Record<string, unknown>).prospectProfile;
    Object.assign(strategy.icpDefinition, {
      onboarding: { introductionSeen: true, prospectsApproved: body.mode === "introduction" ? (strategy.icpDefinition.onboarding?.prospectsApproved ?? false) : true },
      prospectProfile: body.mode === "introduction" && existingProfile ? existingProfile : body.prospectProfile,
    });
    saveStrategy();
    return { strategyId: strategy.id } as T;
  }
  if (path === "/strategy/generate" || /^\/strategy\/[^/]+$/.test(path)) return strategy as T;
  if (path.endsWith("/outreach-message")) {
    if (method === "PATCH") {
      const body = parseRequestBody(options);
      strategy.messagingAngles.outreachMessage = typeof body.message === "string" ? body.message : null;
      strategy.messagingAngles.cta = typeof body.ctaLabel === "string" && typeof body.ctaUrl === "string"
        ? { label: body.ctaLabel, url: body.ctaUrl }
        : null;
      Object.assign(strategy.messagingAngles, { ctaExplicitlySaved: true });
      strategy.messagingAngles.outreachMessageApprovedAt = body.approved === true ? new Date(0).toISOString() : null;
      saveStrategy();
    }
    const cta = strategy.messagingAngles.cta;
    return {
      message: strategy.messagingAngles.outreachMessage,
      ctaLabel: cta?.label ?? null,
      ctaUrl: cta?.url ?? null,
      ctaExplicitlySaved: (strategy.messagingAngles as typeof strategy.messagingAngles & { ctaExplicitlySaved?: boolean }).ctaExplicitlySaved === true,
      approved: Boolean(strategy.messagingAngles.outreachMessageApprovedAt),
    } as T;
  }
  if (path.includes("/campaign-type")) {
    const campaignType = parseRequestBody(options).campaignType;
    Object.assign(strategy.icpDefinition, { contentChoice: parseRequestBody(options).contentChoice });
    const contentChoice = parseRequestBody(options).contentChoice;
    if (typeof contentChoice === "string") {
      try { window.sessionStorage.setItem(savedChoiceKey, contentChoice); } catch { /* Optional preview persistence. */ }
    }
    rememberDemoCampaignType(campaignType);
    if (
      campaignType === "personalized_outreach" ||
      campaignType === "ai_video_ad" ||
      campaignType === "uploaded_video"
    ) {
      strategy.campaignType = campaignType;
    }
    saveStrategy();
    return strategy as T;
  }
  if (path.includes("/video-upload")) {
    const formData = options.body instanceof FormData ? options.body : null;
    const video = formData?.get("video");
    const fileName = video instanceof File ? video.name : "campaign-video.mp4";
    Object.assign(strategy.videoConfig, {
      enabled: true,
      mode: null,
      source: "uploaded",
      tone: null,
      uploadedVideoUrl: `https://preview.leadreacher.ai/uploads/${encodeURIComponent(fileName)}`,
    });
    saveStrategy();
    return strategy as T;
  }
  if (path.includes("/video-decision")) {
    if (method === "PATCH") {
      const videoConfig = parseRequestBody(options);
      Object.assign(strategy.videoConfig, videoConfig);
      Object.assign(strategy.icpDefinition, { approvedContent: { type: strategy.campaignType === "ai_video_ad" ? "AI video" : "Personalized video", style: videoConfig.tone } });
      rememberDemoTone(videoConfig.tone);
      saveStrategy();
    }
    return strategy as T;
  }
  if (path.endsWith("/channels")) {
    if (method === "PATCH") {
      const body = parseRequestBody(options);
      Object.assign(strategy.channels, { selected: body.channels });
      saveStrategy();
    }
    return strategy as T;
  }
  if (path.endsWith("/content-approval")) {
    const approval = parseRequestBody(options);
    Object.assign(strategy.icpDefinition, { approvedContent: approval });
    if (approval.type === "Your video" && !strategy.videoConfig.uploadedVideoUrl) {
      Object.assign(strategy.videoConfig, {
        enabled: true,
        mode: null,
        source: "uploaded",
        tone: null,
        uploadedVideoUrl: `${window.location.origin}/landing/product-story/personalized-video-outreach.mp4`,
        uploadedVideoName: "Acme-product-introduction.mp4",
        uploadedVideoSize: 18 * 1024 * 1024,
      });
    }
    saveStrategy();
    return strategy as T;
  }
  if (path === "/billing/pricing") {
    if (isOnboardingPreview() && window.sessionStorage.getItem("lr_mobile_reference_screen")) {
      return { includedChannels: ["linkedin"], lineItems: [{ key: "platform", priceId: "illustrative-preview", label: "LeadReacher Pro", unitAmount: 9900, currency: "usd", interval: "month", features: ["Personalized outreach", "Audience targeting", "Campaign reporting"] }] } as T;
    }
    return {
      includedChannels: strategy.channels.selected.filter((channel) => channel === "linkedin"),
      lineItems: [
        { key: "platform", priceId: "preview", label: "LeadReacher Pro", unitAmount: 19999, currency: "usd", interval: "month" },
        ...strategy.channels.selected.filter((channel) => channel !== "linkedin").map((channel) => ({ key: "additional_channel", priceId: `preview-channel-${channel}`, label: `${channel} channel`, channel, unitAmount: 5000, currency: "usd", interval: "month" })),
        ...(strategy.videoConfig ? [{ key: "video_addon", priceId: "preview-video", label: "Personalized video", unitAmount: 3000, currency: "usd", interval: "month" }] : []),
      ],
    } as T;
  }
  if (path === "/billing/checkout-session") {
    const requestedDelay = Number(new URLSearchParams(window.location.search).get("stripe_delay") ?? 0);
    const delay = Number.isFinite(requestedDelay) ? Math.min(Math.max(requestedDelay, 0), 2_000) : 0;
    if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
    return { url: null, clientSecret: "preview", mockMode: true } as T;
  }
  if (path === "/billing/checkout-session/reconcile") return { subscriptionStatus: "active" } as T;
  if (path === "/social-accounts" && method === "GET") {
    return {
      accounts: readDemoAccounts(),
    } as T;
  }
  if (path === "/social-accounts/sync") return { synced: true } as T;
  if (path === "/social-accounts/connect") {
    if (usesOnboardingFixtures()) {
      const account = connectDemoAccount(parseRequestBody(options).provider);
      return {
        url: `${isOnboardingDemo() ? "/demo/onboarding" : "/onboarding-preview"}/connect-channels?status=connected&account_id=${account.id}`,
        connectionToken: `demo-${account.id}`,
        account,
      } as T;
    }
    throw new Error("Channel connections are disabled in onboarding preview mode.");
  }
  if (path === "/onboarding/complete") {
    return { completed: true, campaignId: "preview-campaign", launched: false, reviewRequired: true, discoveryStatus: "completed" } as T;
  }

  throw new Error(`No onboarding preview fixture exists for ${method} ${path}`);
}

export function previewOrganization() {
  return {
    orgId: PREVIEW_ORG_ID,
    userId: "onboarding-preview-user",
    subscriptionStatus: null,
    onboardedAt: null,
    activeChannelCount: 1,
    scrapeStatus: fixtureScrapeStatus(),
  };
}
