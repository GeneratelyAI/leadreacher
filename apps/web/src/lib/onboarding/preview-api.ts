const PREVIEW_ORG_ID = "onboarding-preview-org";

export function isOnboardingPreview(): boolean {
  return typeof window !== "undefined" && window.location.pathname === "/onboarding-preview";
}

const strategy = {
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
    recommendations: [
      { channel: "linkedin", label: "LinkedIn", confidence: 92, signalCount: 155, totalProfiles: 180, tag: "Best fit", description: "Most decision makers are reachable here." },
      { channel: "email", label: "Email", confidence: 84, signalCount: 142, totalProfiles: 180, tag: "Strong coverage", description: "Reliable reach for follow-up sequences." },
      { channel: "whatsapp", label: "WhatsApp", confidence: 61, signalCount: 74, totalProfiles: 180, tag: "Selective", description: "Useful where consent and mobile data are available." },
    ],
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
  error: null,
};

/** Deterministic, side-effect-free API responses for the visual onboarding preview. */
export async function previewApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
  const method = (options.method ?? "GET").toUpperCase();

  if (path === "/auth/bootstrap") {
    return {
      orgId: PREVIEW_ORG_ID,
      userId: "onboarding-preview-user",
      subscriptionStatus: null,
      onboardedAt: null,
      activeChannelCount: 1,
      scrapeStatus,
    } as T;
  }
  if (path === "/discovery/scrape-status" || path === "/discovery/scrape") return scrapeStatus as T;
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
  if (path === "/discovery/complete") return { strategyId: strategy.id } as T;
  if (path === "/strategy/generate" || /^\/strategy\/[^/]+$/.test(path)) return strategy as T;
  if (path.endsWith("/outreach-message")) {
    return {
      message:
        "Hi {{First Name}} — I noticed your team is scaling revenue without adding more manual prospecting work. LeadReacher helps coordinate personalized outreach across the channels your buyers already use, while keeping every message reviewable before launch.",
      ctaLabel: "Book a short call",
      ctaUrl: "https://leadreacher.ai/demo",
    } as T;
  }
  if (path.includes("/campaign-type") || path.includes("/video-decision") || path.endsWith("/channels")) return strategy as T;
  if (path === "/billing/pricing") {
    return {
      lineItems: [
        { key: "platform", priceId: "preview", label: "LeadReacher Pro", unitAmount: 30000, currency: "usd", interval: "month" },
      ],
    } as T;
  }
  if (path === "/billing/checkout-session") {
    return { url: null, clientSecret: "preview", mockMode: true } as T;
  }
  if (path === "/billing/checkout-session/reconcile") return { subscriptionStatus: "active" } as T;
  if (path === "/social-accounts" && method === "GET") {
    return {
      accounts: [{ id: "preview-linkedin", platform: "linkedin", providerType: "linkedin", accountName: "Alex Morgan", avatarUrl: null, status: "active" }],
    } as T;
  }
  if (path === "/social-accounts/sync") return { synced: true } as T;
  if (path === "/social-accounts/connect") {
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
    scrapeStatus,
  };
}
