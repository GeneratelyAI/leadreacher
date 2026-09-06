"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo } from "react";
import { Motion } from "@/components/landing/Motion";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, type PillData } from "@/components/onboarding/Pill";
import { AcquisitionWorkflowCarousel } from "@/components/landing/product-story/Showcase";
import { SparklesIcon } from "@/components/ui/animated-highlight-text";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { navigateOnboarding, onboardingHref } from "./steps";

export default function HowItWorks() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo<PillData>(() => {
    const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
    const fields = [
      { label: "Market", value: status.market },
      { label: "Offer", value: status.offer },
      { label: "Customer", value: status.audience },
      { label: "Value", value: status.value },
      { label: "Goal", value: status.strategyStatus },
    ].filter((field): field is { label: string; value: string } => Boolean(field.value?.trim()));

    return {
      status: fields.length > 0 ? "ready" : "learning",
      statusLabel: fields.length > 0 ? "Business understood" : "Building your campaign",
      fields,
      site: website
        ? { label: website.hostname, iconUrl: getWebsiteFaviconUrl(website.hostname) }
        : undefined,
    };
  }, [status.audience, status.market, status.offer, status.strategyStatus, status.url, status.value, websiteUrl]);

  return (
    <section className="how-it-works-campaign-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="how-it-works-campaign-main" aria-labelledby="how-it-works-title">
        <header className="how-it-works-campaign-header">
          <h1 id="how-it-works-title">
            <SparklesIcon className="mr-[0.2em] inline-block text-[#5b3ff0]" />
            How LeadReacher works
          </h1>
          <p>We turn your insights into conversations and qualified opportunities.</p>
        </header>

        <Motion>
          <AcquisitionWorkflowCarousel
            compact
            showPagination={false}
            className="how-it-works-campaign-cards"
          />
        </Motion>

      </main>

      <div className="how-it-works-campaign-actions">
        <Button
          type="button"
          variant="secondary"
          className="how-it-works-campaign-back campaign-content-back"
          onClick={() => navigateOnboarding(onboardingHref("discovery"))}
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          className="onboarding-campaign-next"
          onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}
        >
          Continue
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill campaign={campaign} className="signup-campaign-pill" />
      </aside>
    </section>
  );
}
