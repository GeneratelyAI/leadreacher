"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { BrowserBar } from "@/components/landing/hero/BrowserBar";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, useCampaignConfirmation, type PillData } from "@/components/onboarding/Pill";
import { createSemanticCampaignSummary } from "@/components/onboarding/campaign-summary";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Lock, X } from "@/components/ui/icons";
import ShimmerText from "@/components/ui/shimmer-text";
import { type WebsiteScrapeStatus, useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { cleanWebsiteDomain } from "@/lib/website-url";
import { navigateOnboarding, strategyHref } from "./steps";
import { cn } from "@/lib/utils";
import { ProspectDetailInput } from "../ProspectDetailInput";
import { getDiscoveryOrgScope } from "@/lib/discovery-scrape-cache";

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
  const confirmCampaign = useCampaignConfirmation();

  const [profile, setProfile] = useState<ProspectProfile>(EMPTY_PROFILE);
  const [rowHeights, setRowHeights] = useState<Partial<Record<keyof ProspectProfile, number>>>({});
  const [removingProspects, setRemovingProspects] = useState<Set<string>>(() => new Set());
  const [highlightedRow, setHighlightedRow] = useState<keyof ProspectProfile | null>(null);
  const [removalAnnouncement, setRemovalAnnouncement] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [submittingWebsite, setSubmittingWebsite] = useState(false);
  const [materializeWebsiteIcon, setMaterializeWebsiteIcon] = useState(false);
  const reduceMotion = useReducedMotion();
  const [websiteInput, setWebsiteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sourceUrlRef = useRef<string | null>(null);
  const rowHighlightTimeoutRef = useRef<number | null>(null);
  const actionRowRef = useRef<HTMLDivElement>(null);
  const { status, websiteUrl, loading, message, start, retry } = useWebsiteScrapeStatus({
    context: "authenticated",
  });

  useEffect(() => {
    if (websiteUrl) setWebsiteInput(websiteUrl);
  }, [websiteUrl]);

  useEffect(() => {
    if (status.status !== "completed" || !status.url || sourceUrlRef.current === status.url) return;
    sourceUrlRef.current = status.url;
    setRowHeights({});
    let restored = status.prospectProfile ?? EMPTY_PROFILE;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`) ?? "null");
      const savedProfile = saved?.profile ?? saved;
      if (savedProfile && PROFILE_ROWS.every(({ key }) => Array.isArray(savedProfile[key]) && savedProfile[key].every((value: unknown) => typeof value === "string"))) {
        restored = savedProfile;
        if (saved?.rowHeights && saved.viewportWidth === window.innerWidth) setRowHeights(Object.fromEntries(PROFILE_ROWS.flatMap(({ key }) => Number.isFinite(saved.rowHeights[key]) && saved.rowHeights[key] > 0 ? [[key, saved.rowHeights[key]]] : [])));
      }
    } catch { /* Saved review state is optional when storage is unavailable. */ }
    setProfile(restored);
    setAdditionalContext("");
  }, [status]);

  useEffect(() => () => {
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
  }, []);

  useLayoutEffect(() => {
    const actionRow = actionRowRef.current;
    const pill = document.querySelector<HTMLElement>(".signup-campaign-pill");
    const desktop = window.matchMedia("(min-width: 63.0625rem)");
    if (!actionRow || !pill) return;

    const align = () => {
      if (!desktop.matches) {
        actionRow.style.removeProperty("--discovery-action-offset");
        return;
      }
      const selectorNeedsSpace = Boolean(document.querySelector(".discovery-detail-selector"))
        && (window.innerWidth < 96 * 16 || window.innerHeight < 56.25 * 16);
      if (selectorNeedsSpace) {
        actionRow.style.removeProperty("--discovery-action-offset");
        return;
      }
      const currentOffset = Number.parseFloat(actionRow.style.getPropertyValue("--discovery-action-offset")) || 0;
      const actionBottomWithoutOffset = actionRow.getBoundingClientRect().bottom - currentOffset;
      const offset = pill.getBoundingClientRect().bottom - actionBottomWithoutOffset;
      actionRow.style.setProperty("--discovery-action-offset", `${offset}px`);
    };

    align();
    const resizeObserver = new ResizeObserver(align);
    resizeObserver.observe(actionRow);
    resizeObserver.observe(pill);
    const mutationObserver = new MutationObserver(align);
    mutationObserver.observe(actionRow.parentElement ?? actionRow, { childList: true, subtree: true });
    window.addEventListener("resize", align);
    pill.addEventListener("animationend", align);

    let frame = 0;
    let framesRemaining = 70;
    const settleAfterPillEntrance = () => {
      align();
      if (framesRemaining-- > 0) frame = window.requestAnimationFrame(settleAfterPillEntrance);
    };
    frame = window.requestAnimationFrame(settleAfterPillEntrance);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", align);
      pill.removeEventListener("animationend", align);
      window.cancelAnimationFrame(frame);
    };
  }, [status.status, status.url]);

  const prospectId = (key: keyof ProspectProfile, value: string) => `${key}:${value}`;

  const queueProspectRemoval = (key: keyof ProspectProfile, value: string) => {
    const id = prospectId(key, value);
    setRemovingProspects((current) => current.has(id) ? current : new Set(current).add(id));
  };

  const finishProspectRemoval = (key: keyof ProspectProfile, value: string) => {
    const id = prospectId(key, value);
    setRemovingProspects((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setProfile((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));
    setRemovalAnnouncement(`${value} removed from ${PROFILE_ROWS.find((row) => row.key === key)?.label ?? "prospects"}.`);
    setHighlightedRow(key);
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
    rowHighlightTimeoutRef.current = window.setTimeout(() => setHighlightedRow(null), reduceMotion ? 0 : 460);
  };

  async function submitWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = cleanWebsiteDomain(websiteInput);
    if (!normalized) {
      setError("Enter a valid website URL.");
      return;
    }

    setError(null);
    setSubmittingWebsite(true);
    setMaterializeWebsiteIcon(true);
    sourceUrlRef.current = null;
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
        }),
      });
      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      try {
        const heights = Object.fromEntries(PROFILE_ROWS.map(({ key }) => [key, document.querySelector<HTMLElement>(`[data-prospect-row="${key}"]`)?.offsetHeight]));
        window.sessionStorage.setItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`, JSON.stringify({ profile, rowHeights: heights, viewportWidth: window.innerWidth }));
      } catch { /* The server already saved the audience. */ }
      confirmCampaign?.({
        ...createSemanticCampaignSummary({ ...status, prospectProfile: profile }, undefined, websiteUrl),
        newlyCompletedSectionId: "targeting",
      });
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
          <section className="discovery-website-gate" aria-labelledby="discovery-website-title">
            <div className="signup-campaign-form-column">
              <div className="signup-campaign-copy login-campaign-copy">
                <h1 id="discovery-website-title">
                  {status.status === "failed" ? (
                    <>Let&apos;s try that again<span className="signup-campaign-period">.</span></>
                  ) : (
                    <>What&apos;s your <ShimmerText
                      className="hero-business-shimmer"
                      style={{
                        "--lr-shimmer-base": "#4f46e5",
                        "--lr-shimmer-core": "#58a6ff",
                        "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                      } as CSSProperties}
                    >website</ShimmerText>?</>
                  )}
                </h1>
                <p>We use it to build your first outreach audience.</p>
              </div>

              <BrowserBar
                id="prospect-website"
                value={websiteInput}
                onValueChange={(value) => {
                  setWebsiteInput(value);
                  setError(null);
                  setMaterializeWebsiteIcon(false);
                }}
                onSubmit={submitWebsite}
                formClassName="discovery-hero-browser-bar"
                errorMessage={error ?? (status.status === "failed" ? message : null)}
                disabled={loading || submittingWebsite}
                showSubmit={false}
                errorPosition="flow"
                materializeIcon={materializeWebsiteIcon}
                concealValueWhileDisabled={false}
              >
                <Button type="submit" disabled={loading || submittingWebsite} className="signup-campaign-submit">
                  {loading || submittingWebsite ? "Analyzing your website..." : "Analyze website"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </BrowserBar>

              <p className="discovery-website-security">
                <Lock className="size-4" aria-hidden />
                Your information is secure and private
              </p>
            </div>
          </section>
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
                  <div
                    key={key}
                    data-prospect-row={key}
                    style={rowHeights[key] ? { height: rowHeights[key] } : undefined}
                    className={cn("onboarding-campaign-profile-row", highlightedRow === key && "onboarding-campaign-profile-row-highlighted")}
                  >
                    <p>{label}</p>
                    <div>
                      {profile[key].length > 0 ? (
                        <AnimatePresence
                          initial={false}
                          onExitComplete={() => {
                            profile[key]
                              .filter((value) => removingProspects.has(prospectId(key, value)))
                              .forEach((value) => finishProspectRemoval(key, value));
                          }}
                        >
                          {profile[key].filter((value) => !removingProspects.has(prospectId(key, value))).map((value) => {
                            const accessibleLabel = `Remove ${value} from ${label}`;
                            return (
                              <motion.div
                                layout={!reduceMotion}
                                key={value}
                                className="onboarding-campaign-chip"
                                initial={false}
                                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                                exit={reduceMotion
                                  ? { opacity: 0 }
                                  : { opacity: 0, scale: 0.86, y: -3, filter: "blur(2px)" }}
                                transition={reduceMotion
                                  ? { duration: 0 }
                                  : { duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <button
                                  type="button"
                                  className="onboarding-campaign-chip-label"
                                  onClick={() => queueProspectRemoval(key, value)}
                                  aria-label={accessibleLabel}
                                >
                                  {value}
                                </button>
                                <button
                                  type="button"
                                  className="onboarding-campaign-chip-remove"
                                  onClick={() => queueProspectRemoval(key, value)}
                                  aria-label={accessibleLabel}
                                >
                                  <X className="size-3.5" aria-hidden />
                                </button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      ) : (
                        <span className="onboarding-campaign-empty">No suggestion yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <ProspectDetailInput profile={profile} setProfile={setProfile} onContextChange={setAdditionalContext} disabled={saving} />

              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{removalAnnouncement}</p>

              {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

              <div ref={actionRowRef} className="onboarding-campaign-actions">
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
