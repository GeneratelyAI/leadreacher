"use client";

import { type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/features/onboarding/public/website-status";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { cleanWebsiteDomain } from "@/lib/website-url";
import { normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { navigateOnboarding, onboardingHref, strategyHref } from "../../public/navigation";
import { cn } from "@/lib/utils";
import { ProspectDetailInput } from "../ProspectDetailInput";
import { getDiscoveryOrgScope } from "@/features/onboarding/public/discovery-cache";
import { appendProspectDetail, splitProspectDetails } from "@/features/onboarding/public/prospect-details";
import { isOnboardingPreview } from "@/features/onboarding/public/preview-api";
import { MobileProspectCategory } from "../MobileProspectCategory";
import { WebsiteGate } from "../prospects/WebsiteGate";
import mobileStyles from "../MobileProspects.module.css";

import { PROFILE_ROWS, summaryFrom } from "../../state/prospect-profile";
import { ProspectCategoryValues } from "../prospects/CategoryValues";
import { useProspectReview } from "../../hooks/useProspectReview";
import { useDiscoveryAlignment } from "../../hooks/useDiscoveryAlignment";

function DiscoveryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="onboarding-campaign-layout">
      {children}
    </div>
  );
}

export default function Discovery() {
  const searchParams = useSearchParams();
  const submittedWebsite = useRef(false);
  useLayoutEffect(() => applyStoredTheme(), []);

  const [additionalContext, setAdditionalContext] = useState("");
  const [submittingWebsite, setSubmittingWebsite] = useState(false);
  const [materializeWebsiteIcon, setMaterializeWebsiteIcon] = useState(false);
  const reduceMotion = useReducedMotion();
  const [websiteInput, setWebsiteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { status, websiteUrl, loading, ready, message, start, retry } = useWebsiteScrapeStatus({
    context: "authenticated",
  });

  useLayoutEffect(() => {
    if (websiteUrl) setWebsiteInput(websiteUrl);
  }, [websiteUrl]);

  useEffect(() => {
    if (submittedWebsite.current && status.status === "completed") {
      submittedWebsite.current = false;
      navigateOnboarding(strategyHref("how-it-works"));
    }
  }, [status.status]);

  const { profile, setProfile, removingProspects, highlightedRow, removalAnnouncement, setRemovalAnnouncement, resetReview, prospectId, queueProspectRemoval, finishProspectRemoval } = useProspectReview(status, reduceMotion, setAdditionalContext);

  useDiscoveryAlignment(profile, status.status);

  async function submitWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLandingWebsiteUrl(websiteInput);
    if (!normalized) {
      setError("Enter a valid website URL.");
      return;
    }

    if (status.status === "completed" && normalized === cleanWebsiteDomain(websiteUrl ?? status.url ?? "")) {
      navigateOnboarding(strategyHref("how-it-works"));
      return;
    }

    setError(null);
    setSubmittingWebsite(true);
    submittedWebsite.current = true;
    setMaterializeWebsiteIcon(true);
    resetReview();
    window.localStorage.setItem("lr_website_url", normalized);
    try {
      if (!reduceMotion) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 460));
      }
      if (status.status === "failed") await retry();
      else await start();
    } finally {
      setSubmittingWebsite(false);
    }
  }

  async function handleNext() {
    setError(null);
    if (!Object.values(profile).some((values) => values.length > 0) && !additionalContext.trim()) {
      setError("Select at least one prospect detail or add context for your audience.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<{ strategyId: string }>("/discovery/complete", {
        method: "POST",
        body: JSON.stringify({
          summary: summaryFrom(status, profile),
          messages: [
            { role: "user", content: additionalContext.trim() || "Reviewed suggested prospect audience." },
          ],
          prospectProfile: { ...profile, additionalContext: additionalContext.trim() },
          websiteUrl: websiteUrl ?? status.url ?? undefined,
        }),
      });
      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      try {
        window.sessionStorage.setItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`, JSON.stringify({ profile }));
      } catch { /* The server already saved the audience. */ }
      navigateOnboarding(onboardingHref("campaign-content"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your prospect audience. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const showWebsiteForm = ready && (
    searchParams.get("view") === "website" ||
    status.status === "failed" ||
    (!websiteUrl && status.status === "idle")
  );

  return (
    <div className={cn("onboarding-page box-border h-dvh overflow-hidden bg-[#fdfdff] px-6 py-8 text-[#080e28] lg:px-10 xl:px-14", mobileStyles.screen)}>
      <Link
        href="/"
        aria-label="LeadReacher home"
        className="onboarding-brand-anchor inline-flex"
      >
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>
      {showWebsiteForm ? (
          <WebsiteGate status={status} websiteInput={websiteInput} setWebsiteInput={setWebsiteInput} setError={setError} setMaterializeWebsiteIcon={setMaterializeWebsiteIcon} submitWebsite={submitWebsite} loading={loading} submittingWebsite={submittingWebsite} error={error} message={message} materializeWebsiteIcon={materializeWebsiteIcon} />
        ) : status.status !== "completed" ? (
          <DiscoveryFrame>
            <section
              className="onboarding-campaign-task flex min-h-[calc(100dvh-12rem)] items-center justify-center text-center"
              role="status"
              aria-live="polite"
            >
              <div>
                <h1 className="text-4xl font-bold tracking-[-0.05em]">Analyzing your website</h1>
                <p className="mt-4 text-lg text-[#737a96]">We’re building your acquisition brief.</p>
              </div>
            </section>
          </DiscoveryFrame>
        ) : (
          <DiscoveryFrame>
            <section
              className="onboarding-campaign-task onboarding-discovery-task"
              aria-labelledby="prospect-review-title"
            >
              <div className="onboarding-discovery-content">
                <div className="onboarding-campaign-intro">
                  <h1 id="prospect-review-title" className="onboarding-campaign-heading">
                    Your <span className="whitespace-nowrap">prospects<span className="signup-campaign-period">.</span></span>
                  </h1>
                  <p><span className={mobileStyles.desktopNext}>Here’s who we’re targeting.</span><span className={mobileStyles.mobileNext}>Review who your campaign will reach.</span></p>
                </div>

                <div className="onboarding-campaign-profile">
                  {PROFILE_ROWS.map(({ key, label }) => (
                    <div
                      key={key}
                      data-prospect-row={key}
                      className={cn("onboarding-campaign-profile-row", highlightedRow === key && "onboarding-campaign-profile-row-highlighted")}
                    >
                      <p>{label}</p>
                      <ProspectCategoryValues
                        category={key}
                        label={label}
                        values={profile[key]}
                        removing={removingProspects}
                        onRemove={queueProspectRemoval}
                        onExitComplete={(category) => {
                          profile[category]
                            .filter((value) => removingProspects.has(prospectId(category, value)))
                            .forEach((value) => finishProspectRemoval(category, value));
                        }}
                        prospectId={prospectId}
                        reduceMotion={reduceMotion}
                      />
                      <MobileProspectCategory category={key} label={label} values={profile[key]}
                        initialOpen={isOnboardingPreview() && searchParams.get("screen") === "06" && key === "decisionMakers"}
                        onRemove={finishProspectRemoval}
                        onAdd={(category, raw) => {
                          let next = profile;
                          const added: string[] = [];
                          for (const value of splitProspectDetails(raw)) {
                            const updated = appendProspectDetail(next, category, value);
                            if (updated !== next) added.push(value);
                            next = updated;
                          }
                          setProfile(next);
                          setRemovalAnnouncement(added.length ? `${added.join(", ")} added to ${label}.` : "Those details are already in your audience.");
                        }}
                      />
                    </div>
                  ))}
                </div>

                <ProspectDetailInput profile={profile} setProfile={setProfile} onContextChange={setAdditionalContext} disabled={saving} initialPlacement={isOnboardingPreview() && searchParams.get("screen") === "07" ? "Healthcare" : undefined} />

                <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{removalAnnouncement}</p>

                {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
              </div>

              <div className="onboarding-campaign-actions">
                <Button type="button" variant="secondary" className="campaign-content-back discovery-back" onClick={() => navigateOnboarding(strategyHref("how-it-works"))}>
                  <ArrowLeft className="size-5" aria-hidden />Back
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  className="onboarding-campaign-next"
                  onClick={handleNext}
                >
                  {saving ? "Saving..." : <><span className={mobileStyles.desktopNext}>Next</span><span className={mobileStyles.mobileNext}>Continue</span></>}
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              </div>
            </section>

          </DiscoveryFrame>
        )}
    </div>
  );
}
