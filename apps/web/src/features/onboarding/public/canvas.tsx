"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import { useWebsiteScrapeStatus } from "./website-status";
import { createConfirmedCampaignSummary, type SavedCampaignSummary } from "./summary";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { CAMPAIGN_SAVED_EVENT } from "./campaign-events";
import { CampaignData } from "../state/campaign-context";
import MobileOnboardingHeader from "./mobile-header";
import mobileStyles from "../components/MobileOnboarding.module.css";
import { PillView } from "../components/PillView";

/** The host remains mounted while route-owned content changes. */
export function CampaignCanvas({ children, initialWebsiteUrl }: { children: ReactNode; initialWebsiteUrl?: string }) {
  const routeParams = useSearchParams();
  const [saved, setSaved] = useState<{ websiteUrl: string; campaign: SavedCampaignSummary } | null>(null);
  const [revision, setRevision] = useState(0);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  useEffect(() => {
    if (!websiteUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const next = await apiFetch<SavedCampaignSummary>(`/strategy/${orgId}`);
        if (!cancelled) setSaved({ websiteUrl, campaign: next });
      } catch { /* The task owns recovery errors; retain the available business summary. */ }
    })();
    return () => { cancelled = true; };
  }, [websiteUrl, revision]);
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener(CAMPAIGN_SAVED_EVENT, refresh);
    return () => window.removeEventListener(CAMPAIGN_SAVED_EVENT, refresh);
  }, []);
  const campaign = useMemo(() => createConfirmedCampaignSummary(status, saved?.websiteUrl === websiteUrl ? saved.campaign : null, websiteUrl ?? initialWebsiteUrl), [status, saved, websiteUrl, initialWebsiteUrl]);
  return (
    <CampaignData.Provider value={campaign}>
      <div className={cn("onboarding-campaign-scene", mobileStyles.shell)} data-mobile-checkout={routeParams.get("step") === "checkout" || routeParams.get("screen") === "13" || undefined}>
        <MobileOnboardingHeader />
        <Link href="/" prefetch={false} aria-label="LeadReacher home" className="onboarding-brand-anchor onboarding-persistent-logo inline-flex">
          <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
        </Link>
        <aside className="signup-campaign-pill-column onboarding-persistent-pill" data-campaign-site={campaign.site?.label || undefined} aria-label="Live campaign summary">
          <PillView
            campaign={campaign}
            className="signup-campaign-pill"
            responsiveDefaultCollapsed
          />
        </aside>
        {children}
      </div>
    </CampaignData.Provider>
  );
}
