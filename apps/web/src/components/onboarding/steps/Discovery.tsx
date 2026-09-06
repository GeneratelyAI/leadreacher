"use client";

import { type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, type PillData } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight, Globe, Lock } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { type WebsiteScrapeStatus, useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { cleanWebsiteDomain } from "@/lib/website-url";
import { navigateOnboarding, strategyHref } from "./steps";
import { cn } from "@/lib/utils";

type ProspectProfile = NonNullable<WebsiteScrapeStatus["prospectProfile"]>;

const EMPTY_PROFILE: ProspectProfile = {
  decisionMakers: [],
  companyTypes: [],
  industries: [],
  locations: [],
};

const PROFILE_ROWS: Array<{ key: keyof ProspectProfile; label: string }> = [
  { key: "decisionMakers", label: "Decision makers" },
  { key: "companyTypes", label: "Company types" },
  { key: "industries", label: "Industries" },
  { key: "locations", label: "Location" },
];

function campaignFromStatus(status: WebsiteScrapeStatus, websiteUrl: string | null): PillData {
  const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
  return {
    status: status.status === "completed" ? "ready" : "learning",
    statusLabel: status.status === "completed" ? "Business understood" : "Building your campaign",
    fields: [
      { label: "Market", value: status.market },
      { label: "Offer", value: status.offer },
      { label: "Customer", value: status.audience },
      { label: "Value", value: status.value },
      { label: "Goal", value: status.strategyStatus },
    ].filter((field) => Boolean(field.value.trim())),
    site: website
      ? { label: website.hostname, iconUrl: getWebsiteFaviconUrl(website.hostname) }
      : undefined,
  };
}

function summaryFrom(status: WebsiteScrapeStatus, profile: ProspectProfile) {
  const target = [
    profile.decisionMakers.join(", "),
    profile.companyTypes.join(", "),
    profile.locations.length ? `in ${profile.locations.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" at ");

  return {
    businessModel: status.offer || "Website-based outreach offer",
    industry: profile.industries[0] || status.market || "Business services",
    strengths: status.value || "Personalized outreach",
    idealCustomer: target || status.audience || "Qualified prospects",
    suggestedChannels: [],
    nextStep: status.strategyStatus || "Prepare a personalized outreach strategy.",
    websiteEnriched: true,
    websiteImageUrl: null,
  };
}

type DiscoveryFrameProps = {
  children: ReactNode;
  campaign: PillData;
  className?: string;
};

function DiscoveryFrame({
  children,
  campaign,
  className,
}: DiscoveryFrameProps) {
  return (
    <div className={cn("onboarding-campaign-layout", className)}>
      {children}
      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill
          campaign={campaign}
          className="signup-campaign-pill"
        />
      </aside>
    </div>
  );
}

export default function Discovery() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const [profile, setProfile] = useState<ProspectProfile>(EMPTY_PROFILE);
  const [additionalContext, setAdditionalContext] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sourceUrlRef = useRef<string | null>(null);
  const { status, websiteUrl, loading, message, start, retry } = useWebsiteScrapeStatus({
    context: "authenticated",
  });

  useEffect(() => {
    if (websiteUrl) setWebsiteInput(websiteUrl);
  }, [websiteUrl]);

  useEffect(() => {
    if (status.status !== "completed" || !status.url || sourceUrlRef.current === status.url) return;
    sourceUrlRef.current = status.url;
    setProfile(status.prospectProfile ?? EMPTY_PROFILE);
    setAdditionalContext("");
  }, [status]);

  const toggle = (key: keyof ProspectProfile, value: string) => {
    setProfile((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  async function submitWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = cleanWebsiteDomain(websiteInput);
    if (!normalized) {
      setError("Enter a valid website URL.");
      return;
    }

    setError(null);
    sourceUrlRef.current = null;
    window.localStorage.setItem("lr_website_url", normalized);
    if (status.status === "failed") await retry();
    else await start();
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
        }),
      });
      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      navigateOnboarding(strategyHref("how-it-works"));
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

  const showWebsiteForm = status.status === "idle" || status.status === "failed";
  const campaign = campaignFromStatus(status, websiteUrl);

  return (
    <div className="onboarding-page box-border h-dvh overflow-hidden bg-[#fdfdff] px-6 py-8 text-[#080e28] lg:px-10 xl:px-14">
      <Link
        href="/"
        aria-label="LeadReacher home"
        className="onboarding-brand-anchor inline-flex"
      >
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>
      {showWebsiteForm ? (
          <DiscoveryFrame
            campaign={campaign}
            className="signup-campaign-layout discovery-website-gate"
          >
            <div className="signup-campaign-form-column">
              <div className="signup-campaign-copy login-campaign-copy">
                <h1>
                  {status.status === "failed" ? (
                    <>Let&apos;s try that again<span className="signup-campaign-period">.</span></>
                  ) : (
                    <>What&apos;s your website?</>
                  )}
                </h1>
                <p>We use it to build your first outreach audience.</p>
              </div>

              <form className="signup-campaign-auth-actions space-y-3" onSubmit={submitWebsite}>
                <div className="relative">
                  <Label htmlFor="prospect-website" className="sr-only">Company website</Label>
                  <Globe
                    className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]"
                    aria-hidden
                  />
                  <Input
                    id="prospect-website"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={websiteInput}
                    onChange={(event) => {
                      setWebsiteInput(event.target.value);
                      setError(null);
                    }}
                    placeholder="Company website"
                    className="signup-campaign-control h-15 rounded-xl border-neutral-200 bg-white pl-13 pr-4 text-[0.98rem] text-[#15192c] shadow-none placeholder:text-[#8a90a8] focus-visible:border-[#5b3ff0] focus-visible:ring-4 focus-visible:ring-[#5b3ff0]/10"
                  />
                </div>
                {error || (status.status === "failed" ? message : null) ? (
                  <p role="alert" className="signup-campaign-error">{error ?? message}</p>
                ) : null}
                <Button type="submit" disabled={loading} className="signup-campaign-submit">
                  {loading ? "Analyzing your website..." : "Analyze website"}
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              </form>

              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#737a96]">
                <Lock className="size-4" aria-hidden />
                Your information is secure and private
              </p>
            </div>
          </DiscoveryFrame>
        ) : status.status !== "completed" ? (
          <DiscoveryFrame
            campaign={campaign}
          >
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
          <DiscoveryFrame
            campaign={campaign}
          >
            <section className="onboarding-campaign-task" aria-labelledby="prospect-review-title">
              <div className="onboarding-campaign-intro">
                <h1 id="prospect-review-title" className="onboarding-campaign-heading">
                  Your prospects<span className="signup-campaign-period">.</span>
                </h1>
                <p>Here’s who we’re targeting.</p>
              </div>

              <div className="onboarding-campaign-profile">
                {PROFILE_ROWS.map(({ key, label }) => (
                  <div key={key} className="onboarding-campaign-profile-row">
                    <p>{label}</p>
                    <div>
                      {profile[key].length > 0 ? profile[key].map((value) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed="true"
                          onClick={() => toggle(key, value)}
                          className="onboarding-campaign-chip"
                        >
                          {value}
                        </button>
                      )) : (
                        <span className="onboarding-campaign-empty">No suggestion yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="onboarding-campaign-context">
                <Label htmlFor="prospect-context">
                  Did we miss anything?
                </Label>
                <textarea
                  id="prospect-context"
                  value={additionalContext}
                  onChange={(event) => setAdditionalContext(event.target.value)}
                  placeholder="Add any job titles or customer details we missed..."
                  className="onboarding-campaign-context-input"
                />
              </div>

              {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

              <div className="onboarding-campaign-actions">
                <Button
                  type="button"
                  disabled={saving}
                  className="onboarding-campaign-next"
                  onClick={handleNext}
                >
                  {saving ? "Saving..." : "Next"}
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              </div>
            </section>

          </DiscoveryFrame>
        )}
    </div>
  );
}
