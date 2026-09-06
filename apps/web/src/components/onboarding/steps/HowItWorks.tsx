"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, type CSSProperties } from "react";
import { Motion } from "@/components/landing/Motion";
import { createSemanticCampaignSummary } from "@/components/onboarding/campaign-summary";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill } from "@/components/onboarding/Pill";
import { AcquisitionWorkflowCarousel } from "@/components/landing/product-story/Showcase";
import { Highlight, SparklesIcon } from "@/components/ui/animated-highlight-text";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import ShimmerText from "@/components/ui/shimmer-text";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { navigateOnboarding, onboardingHref } from "./steps";

export default function HowItWorks() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo(
    () => createSemanticCampaignSummary(status, undefined, websiteUrl),
    [status, websiteUrl],
  );

  return (
    <section className="how-it-works-campaign-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="how-it-works-campaign-main" aria-labelledby="how-it-works-title">
        <header className="how-it-works-campaign-header">
          <h1 id="how-it-works-title">
            <Highlight
              autoPlay
              autoPlayDuration={1400}
              icon={<SparklesIcon animationDurationScale={1.6} className="mr-[0.2em] text-[#5b3ff0]" />}
              className="!m-0 !inline !p-0 !font-inherit !text-inherit !transition-none !cursor-default hover:!bg-transparent focus-visible:!bg-transparent focus-visible:!outline-none"
            >
              How <ShimmerText
                duration={3.6}
                style={
                  {
                    "--lr-shimmer-base": "#4f46e5",
                    "--lr-shimmer-core": "#58a6ff",
                    "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                  } as CSSProperties
                }
              >LeadReacher</ShimmerText> works
            </Highlight>
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
