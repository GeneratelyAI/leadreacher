"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { SparklesIcon } from "@/components/ui/animated-highlight-text";
import ShimmerText from "@/components/ui/shimmer-text";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { HowItWorksIllustration, useHowItWorksStory } from "./HowItWorksIllustrations";
import styles from "./HowItWorks.module.css";
import { useWebsiteScrapeStatus } from "@/features/onboarding/public/website-status";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { navigateOnboarding, onboardingHref } from "../../public/navigation";

const EXPLANATION = [
  { text: "We find the right prospects.", title: "Find the right prospects", description: "We find and qualify prospects that match your ideal customer profile." },
  { text: "We create personalized content.", title: "Create personalized content", description: "We craft personalized videos and messages that speak to each prospect." },
  { text: "We reach them automatically.", title: "Reach them automatically", description: "We send your content across channels and follow up automatically." },
  { text: "They respond. You close.", title: "They respond. You close.", description: "Interested prospects reply. You have the conversation and close more deals." },
] as const;

export default function HowItWorks() {
  useLayoutEffect(() => applyStoredTheme(), []);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useStableReducedMotion();
  const [sparkleReplay, setSparkleReplay] = useState(0);
  const replaySparkle = () => {
    if (!reduceMotion) setSparkleReplay((current) => current + 1);
  };
  const storyRef = useRef<HTMLOListElement>(null);
  useHowItWorksStory(storyRef, websiteUrl);

  async function continueToProspects() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/discovery/complete", {
        method: "POST",
        body: JSON.stringify({
          mode: "introduction",
          websiteUrl: websiteUrl ?? status.url,
          summary: {
            businessModel: status.offer || status.market,
            industry: status.market || status.offer,
            strengths: status.value || status.offer,
            idealCustomer: status.audience || status.market,
            nextStep: status.strategyStatus,
          },
          messages: [{ role: "user", content: "Continue to review audience criteria." }],
          prospectProfile: status.prospectProfile ? { ...status.prospectProfile, additionalContext: "" } : undefined,
        }),
      });
      navigateOnboarding(onboardingHref("discovery"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to restore your campaign. Please try again.");
      setSaving(false);
    }
  }

  return <section className={`how-it-works-campaign-page how-it-works-explanation ${styles.page}`}>
    <main className="how-it-works-campaign-main" aria-labelledby="how-it-works-title">
      <header className="how-it-works-campaign-header" data-explanation-heading>
        <h1 id="how-it-works-title" className={styles.title} onMouseEnter={replaySparkle} onFocus={replaySparkle}>
          <SparklesIcon key={`${reduceMotion}:${sparkleReplay}`} draw={!reduceMotion} animationDurationScale={2 / 0.85} className={styles.sparkle} />
          <span>How <ShimmerText key={`${reduceMotion}:${sparkleReplay}`} duration={3.6} className={styles.materializingWord} data-materialize={!reduceMotion}>LeadReacher</ShimmerText> works<span className="signup-campaign-period">.</span></span>
        </h1>
      </header>
      <ol ref={storyRef} className={`how-it-works-sequence ${styles.sequence}`} aria-label="Your campaign journey">
        {EXPLANATION.map(({ text, title, description }, index) => <li key={text} data-explanation-step>
          <span className="how-it-works-illustration" data-audience-illustration={index === 0 ? "true" : undefined} aria-hidden>
            <HowItWorksIllustration index={index} />
          </span>
          <span className={styles.number} aria-hidden>{index + 1}</span>
          <p><span className={styles.desktopCopy}>{text}</span><span className={styles.mobileCopy}><strong>{title}</strong><span>{description}</span></span></p>
          {index < EXPLANATION.length - 1 ? <ArrowRight className="how-it-works-connector" aria-hidden /> : null}
        </li>)}
      </ol>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </main>
    <div className="how-it-works-campaign-actions">
      <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(`${onboardingHref("discovery")}&view=website`)}>
        <ArrowLeft className="size-5" aria-hidden />Back
      </Button>
      <Button type="button" className="onboarding-campaign-next" disabled={saving} onClick={continueToProspects}>
        {saving ? "Saving..." : "Continue to prospects"}<ArrowRight className="size-5" aria-hidden />
      </Button>
    </div>
  </section>;
}
