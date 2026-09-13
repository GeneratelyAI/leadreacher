"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import { useWebsiteScrapeStatus } from "./website-status";
import { createConfirmedCampaignSummary, type SavedCampaignSummary } from "./summary";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { CAMPAIGN_CHANNEL_SELECTION_EVENT, CAMPAIGN_SAVED_EVENT } from "./campaign-events";
import { CampaignData, CampaignDraft, type CampaignPillDraft } from "../state/campaign-context";
import MobileOnboardingHeader from "./mobile-header";
import mobileStyles from "../components/MobileOnboarding.module.css";
import { PillView } from "../components/PillView";
import { onboardingRouteFromPathname } from "./navigation";

/** The host remains mounted while route-owned content changes. */
export function CampaignCanvas({
  children,
  initialWebsiteUrl,
}: {
  children: ReactNode;
  initialWebsiteUrl?: string;
}) {
  const routeParams = useSearchParams();
  const pathname = usePathname();
  const [saved, setSaved] = useState<{ websiteUrl: string; campaign: SavedCampaignSummary } | null>(null);
  const [revision, setRevision] = useState(0);
  const [optimisticChannels, setOptimisticChannels] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<CampaignPillDraft | null>(null);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  useEffect(() => {
    if (!websiteUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const organization = await bootstrapCurrentOrganization();
        const next = await apiFetch<SavedCampaignSummary>(`/strategy/${organization.orgId}`);
        if (!cancelled) {
          setSaved({ websiteUrl, campaign: { ...next, subscriptionStatus: organization.subscriptionStatus } });
          if (!pathname.endsWith("/channels")) setOptimisticChannels(null);
        }
      } catch { /* The task owns recovery errors; retain the available business summary. */ }
    })();
    return () => { cancelled = true; };
  }, [pathname, websiteUrl, revision]);
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener(CAMPAIGN_SAVED_EVENT, refresh);
    return () => window.removeEventListener(CAMPAIGN_SAVED_EVENT, refresh);
  }, []);
  useEffect(() => {
    const updateChannels = (event: Event) => {
      const channels = (event as CustomEvent<unknown>).detail;
      if (!Array.isArray(channels) || channels.some((channel) => typeof channel !== "string")) return;
      setOptimisticChannels(channels);
    };
    window.addEventListener(CAMPAIGN_CHANNEL_SELECTION_EVENT, updateChannels);
    return () => window.removeEventListener(CAMPAIGN_CHANNEL_SELECTION_EVENT, updateChannels);
  }, []);
  const savedCampaign = useMemo(() => {
    const persisted = saved?.websiteUrl === websiteUrl ? saved.campaign : null;
    const campaign = optimisticChannels
      ? { ...(persisted ?? {}), channels: { selected: optimisticChannels } }
      : persisted;
    return createConfirmedCampaignSummary(status, campaign, websiteUrl ?? initialWebsiteUrl);
  }, [initialWebsiteUrl, optimisticChannels, saved, status, websiteUrl]);
  const activeRoute = onboardingRouteFromPathname(pathname.replace(/^\/onboarding-preview/, "/onboarding").replace(/^\/demo\/onboarding/, "/onboarding"));
  const activeSection = ({ discovery: "targeting", "campaign-content": "content", "personalized-video": "content", "ai-video": "content", "your-video": "content", document: "content", cta: "message", channels: "channels", checkout: "subscription" } as Record<string, string | undefined>)[activeRoute ?? ""];
  const campaign = useMemo(() => {
    const sections = savedCampaign.sections?.map((section) => {
      if (draft?.sectionId === section.id) return { ...section, state: "draft" as const, summary: draft.summary, value: draft.value ?? draft.summary };
      if (section.id === activeSection && section.state !== "complete") return { ...section, state: "pending" as const, pendingLabel: `Choosing ${section.label.toLowerCase()}` };
      return section;
    });
    return { ...savedCampaign, sections };
  }, [activeSection, draft, savedCampaign]);
  useEffect(() => { setDraft((current) => current?.sectionId === activeSection ? current : null); }, [activeSection]);
  const clearDraft = useCallback(() => setDraft(null), []);
  const checkout = pathname.endsWith("/checkout") || routeParams.get("screen") === "13";
  return (
    <CampaignData.Provider value={campaign}>
      <CampaignDraft.Provider value={{ draft, setDraft, clearDraft }}>
        <div className={cn("onboarding-campaign-scene", mobileStyles.shell)} data-mobile-checkout={checkout || undefined}>
          <MobileOnboardingHeader />
          <Link href="/" prefetch={false} aria-label="LeadReacher home" className="onboarding-brand-anchor onboarding-persistent-logo inline-flex">
            <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
          </Link>
          <aside className="signup-campaign-pill-column onboarding-persistent-pill" data-campaign-site={campaign.site?.label || undefined} aria-label="Campaign summary">
            <PillView
              campaign={campaign}
              className="signup-campaign-pill"
              responsiveDefaultCollapsed
            />
          </aside>
          {children}
        </div>
      </CampaignDraft.Provider>
    </CampaignData.Provider>
  );
}
