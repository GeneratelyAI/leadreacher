"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrowserBar } from "@/components/landing/hero/BrowserBar";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, useCampaignConfirmation, type PillData } from "@/components/onboarding/Pill";
import { createLiveCampaignSummary } from "@/components/onboarding/campaign-summary";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Lock, X } from "@/components/ui/icons";
import ShimmerText from "@/components/ui/shimmer-text";
import { type WebsiteScrapeStatus, useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { cleanWebsiteDomain } from "@/lib/website-url";
import { navigateOnboarding, onboardingHref, strategyHref } from "./steps";
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

const CHIP_GAP = 10.4;

function campaignFromStatus(status: WebsiteScrapeStatus, websiteUrl: string | null): PillData {
  return createLiveCampaignSummary(status, "discovery", undefined, websiteUrl);
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

type ProspectCategoryValuesProps = {
  category: keyof ProspectProfile;
  label: string;
  values: string[];
  removing: Set<string>;
  onRemove: (category: keyof ProspectProfile, value: string) => void;
  onExitComplete: (category: keyof ProspectProfile) => void;
  prospectId: (category: keyof ProspectProfile, value: string) => string;
  reduceMotion: boolean | null;
};

function ProspectCategoryValues({ category, label, values, removing, onRemove, onExitComplete, prospectId, reduceMotion }: ProspectCategoryValuesProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const suppressTriggerFocusRef = useRef(false);
  const [visibleIndexes, setVisibleIndexes] = useState<number[] | null>(null);
  const [reservedWidths, setReservedWidths] = useState<number[]>([]);
  const [collapsedWidths, setCollapsedWidths] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const overflowValues = visibleIndexes === null ? [] : values.filter((_, index) => !visibleIndexes.includes(index));
  const popoverId = `prospect-overflow-${category}`;

  useEffect(() => {
    if (!open || overflowValues.length) return;
    setOpen(false);
    railRef.current?.querySelector<HTMLButtonElement>(".onboarding-campaign-chip-remove")?.focus({ preventScroll: true });
  }, [open, overflowValues.length]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const measure = measureRef.current;
    if (!rail || !measure) return;
    let frame = 0;
    const recalculate = () => {
      const railStyle = window.getComputedStyle(rail);
      const available = rail.clientWidth - Number.parseFloat(railStyle.paddingLeft) - Number.parseFloat(railStyle.paddingRight);
      const chips = Array.from(measure.querySelectorAll<HTMLElement>("[data-chip-measure]"));
      const expandedChips = Array.from(measure.querySelectorAll<HTMLElement>("[data-chip-expanded-measure]"));
      const triggers = new Map(Array.from(measure.querySelectorAll<HTMLElement>("[data-trigger-measure]")).map((node) => [Number(node.dataset.triggerMeasure), node.offsetWidth]));
      // offsetWidth rounds to an integer. Round the untransformed CSS width up
      // instead so subpixel text metrics cannot lose their final glyph.
      const nextReservedWidths = expandedChips.map((chip) => Math.ceil(Number.parseFloat(getComputedStyle(chip).width)));
      let next = values.map((_, index) => index);
      for (let count = values.length; count >= 0; count -= 1) {
        const candidate = [...Array(count).keys()];
        const hidden = values.length - candidate.length;
        const width = candidate.reduce((sum, index) => sum + (nextReservedWidths[index] ?? 0), 0)
          + Math.max(0, candidate.length - 1) * CHIP_GAP
          + (hidden ? (candidate.length ? CHIP_GAP : 0) + (triggers.get(hidden) ?? 0) : 0);
        if (width <= available) {
          next = candidate;
          break;
        }
      }
      setVisibleIndexes(next);
      setReservedWidths(nextReservedWidths);
      setCollapsedWidths(chips.map((chip) => chip.offsetWidth));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(recalculate);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(rail);
    void document.fonts?.ready?.then(schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [values]);

  useEffect(() => {
    if (!open || !overflowValues.length) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = popoverRef.current?.offsetWidth ?? 368;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 240;
      const horizontalInset = 16;
      const verticalInset = 16;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const left = Math.max(viewportLeft + horizontalInset, Math.min(rect.left, viewportLeft + viewportWidth - popoverWidth - horizontalInset));
      const preferredTop = rect.bottom + 8;
      const top = preferredTop + popoverHeight <= viewportTop + viewportHeight - verticalInset
        ? preferredTop
        : Math.max(viewportTop + verticalInset, rect.top - popoverHeight - 8);
      if (popoverRef.current) popoverRef.current.style.maxHeight = `${Math.max(44, viewportHeight - 2 * verticalInset)}px`;
      setPosition({ left, top });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      suppressTriggerFocusRef.current = true;
      triggerRef.current?.focus({ preventScroll: true });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      suppressTriggerFocusRef.current = true;
      triggerRef.current?.focus({ preventScroll: true });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    const observer = new ResizeObserver(updatePosition);
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      if (popoverRef.current) observer.observe(popoverRef.current);
      closeRef.current?.focus({ preventScroll: true });
    });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, overflowValues.length]);

  const renderChip = (value: string, index: number, reserveWidth = false) => {
    const accessibleLabel = `Remove ${value} from ${label}`;
    return (
      <motion.div
        layout={reduceMotion ? false : "position"}
        key={value}
        className={cn("onboarding-campaign-chip-slot", reserveWidth && "onboarding-campaign-chip-slot-reserved")}
        style={reserveWidth && reservedWidths[index] ? {
          "--prospect-chip-slot-width": `${reservedWidths[index]}px`,
          "--prospect-chip-collapsed-offset": `${Math.max(0, reservedWidths[index] - (collapsedWidths[index] ?? reservedWidths[index]))}px`,
        } as CSSProperties : undefined}
        initial={false}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: -3, filter: "blur(2px)" }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="onboarding-campaign-chip"
          whileHover={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
          whileFocus={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="onboarding-campaign-chip-label">{value}</span>
          <button type="button" className="onboarding-campaign-chip-remove" onClick={() => onRemove(category, value)} aria-label={accessibleLabel}><X className="size-3.5" aria-hidden /></button>
        </motion.div>
      </motion.div>
    );
  };

  const finishExits = () => onExitComplete(category);
  return <>
    <div ref={railRef} className="onboarding-campaign-profile-values onboarding-campaign-profile-rail" data-measured={visibleIndexes === null ? undefined : "true"}>
      {values.length ? <AnimatePresence initial={false} mode="popLayout" onExitComplete={finishExits}>
        {visibleIndexes === null
          ? values.filter((value) => !removing.has(prospectId(category, value))).map((value, index) => renderChip(value, index))
          : visibleIndexes.filter((index) => !removing.has(prospectId(category, values[index]))).map((index) => renderChip(values[index], index, true))}
      </AnimatePresence> : <span className="onboarding-campaign-empty">No suggestion yet</span>}
      {overflowValues.length ? <button ref={triggerRef} data-prospect-overflow-trigger={category} type="button" className="onboarding-campaign-overflow-trigger" aria-label={`Show ${overflowValues.length} more ${label.toLowerCase()}`} aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen(true)} onFocus={() => { if (suppressTriggerFocusRef.current) { suppressTriggerFocusRef.current = false; return; } setOpen(true); }}>+{overflowValues.length} more</button> : null}
    </div>
    <div ref={measureRef} className="onboarding-campaign-chip-measure" aria-hidden="true">
      {values.map((value) => <span key={value} data-chip-measure className="onboarding-campaign-chip-measure-item"><span className="onboarding-campaign-chip-label">{value}</span></span>)}
      {values.map((value) => <span key={value} data-chip-expanded-measure className="onboarding-campaign-chip-measure-item onboarding-campaign-chip-measure-expanded"><span className="onboarding-campaign-chip-label">{value}</span><span className="onboarding-campaign-chip-remove"><X className="size-3.5" /></span></span>)}
      {values.map((_, index) => <span key={index} data-trigger-measure={values.length - index} className="onboarding-campaign-overflow-trigger">+{values.length - index} more</span>)}
    </div>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && position && overflowValues.length ? <motion.div id={popoverId} ref={popoverRef} role="dialog" aria-label={`${label} selections`} className="onboarding-campaign-overflow-popover" style={{ left: position.left, top: position.top }} initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      <div className="onboarding-campaign-overflow-heading"><div><strong>{label}</strong><span>{values.length} selected</span></div><button ref={closeRef} type="button" aria-label={`Close ${label}`} onClick={() => { setOpen(false); suppressTriggerFocusRef.current = true; triggerRef.current?.focus({ preventScroll: true }); }}><X className="size-4" aria-hidden /></button></div>
      <div className="onboarding-campaign-overflow-values"><AnimatePresence initial={false} mode="popLayout" onExitComplete={finishExits}>{values.map((value, index) => ({ value, index })).filter(({ index }) => !visibleIndexes?.includes(index) && !removing.has(prospectId(category, values[index]))).map(({ value, index }) => renderChip(value, index))}</AnimatePresence></div>
    </motion.div> : null}</AnimatePresence>, document.body)}
  </>;
}

export default function Discovery() {
  const searchParams = useSearchParams();
  const submittedWebsite = useRef(false);
  useLayoutEffect(() => applyStoredTheme(), []);
  const confirmCampaign = useCampaignConfirmation();

  const [profile, setProfile] = useState<ProspectProfile>(EMPTY_PROFILE);
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

  useEffect(() => {
    if (!sourceUrlRef.current || !status.url) return;
    try {
      window.sessionStorage.setItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`, JSON.stringify({ profile }));
    } catch { /* The saved campaign remains authoritative; drafts are optional. */ }
  }, [profile, status.url]);

  useEffect(() => {
    if (status.status !== "completed" || !status.url || sourceUrlRef.current === status.url) return;
    sourceUrlRef.current = status.url;
    let restored = status.prospectProfile ?? EMPTY_PROFILE;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`) ?? "null");
      const savedProfile = saved?.profile ?? saved;
      if (savedProfile && PROFILE_ROWS.every(({ key }) => Array.isArray(savedProfile[key]) && savedProfile[key].every((value: unknown) => typeof value === "string"))) {
        restored = savedProfile;
      }
    } catch { /* Saved review state is optional when storage is unavailable. */ }
    setProfile(restored);
    setAdditionalContext("");
  }, [status]);

  useEffect(() => () => {
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
  }, []);

  useLayoutEffect(() => {
    const task = document.querySelector<HTMLElement>(".onboarding-discovery-task");
    const detailEntry = task?.querySelector<HTMLElement>(".discovery-detail-entry");
    const actionRow = task?.querySelector<HTMLElement>(".onboarding-campaign-actions");
    const pill = document.querySelector<HTMLElement>(".signup-campaign-pill");
    const desktop = window.matchMedia("(min-width: 63.0625rem)");
    if (!task || !detailEntry || !actionRow || !pill) return;

    const alignColumn = () => {
      if (!desktop.matches) {
        task.style.removeProperty("--discovery-column-offset");
        task.style.removeProperty("--discovery-content-offset");
        return;
      }

      // The selector reserves its own space in normal flow. Keeping the parent
      // fixed while it is present prevents measuring a translated action row.
      if (task.querySelector(".discovery-detail-selector")) return;

      const currentColumnOffset = Number.parseFloat(task.style.getPropertyValue("--discovery-column-offset")) || 0;
      const currentContentOffset = Number.parseFloat(task.style.getPropertyValue("--discovery-content-offset")) || 0;
      const pillBottom = pill.getBoundingClientRect().bottom;
      const columnDelta = pillBottom - actionRow.getBoundingClientRect().bottom;
      const gap = actionRow.getBoundingClientRect().top - detailEntry.getBoundingClientRect().bottom;

      task.style.setProperty("--discovery-column-offset", `${currentColumnOffset + columnDelta}px`);
      task.style.setProperty("--discovery-content-offset", `${Math.max(0, currentContentOffset + gap - 24)}px`);
      window.dispatchEvent(new Event("discovery-layout-change"));
    };

    alignColumn();
    const resizeObserver = new ResizeObserver(alignColumn);
    resizeObserver.observe(task);
    const detailObserver = new MutationObserver(() => {
      window.requestAnimationFrame(alignColumn);
    });
    detailObserver.observe(detailEntry.parentElement ?? task, { childList: true, subtree: true });
    window.addEventListener("resize", alignColumn);

    return () => {
      resizeObserver.disconnect();
      detailObserver.disconnect();
      window.removeEventListener("resize", alignColumn);
    };
  }, [profile, status.status]);

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
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
    rowHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedRow(key);
      rowHighlightTimeoutRef.current = window.setTimeout(() => setHighlightedRow(null), reduceMotion ? 0 : 460);
    }, reduceMotion ? 0 : 210);
  };

  async function submitWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = cleanWebsiteDomain(websiteInput);
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
          websiteUrl: websiteUrl ?? status.url ?? undefined,
        }),
      });
      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      try {
        window.sessionStorage.setItem(`lr_prospect_review:${getDiscoveryOrgScope() ?? "preview"}:${status.url}`, JSON.stringify({ profile }));
      } catch { /* The server already saved the audience. */ }
      confirmCampaign?.(createLiveCampaignSummary(
        { ...status, prospectProfile: profile },
        "campaign-content",
        undefined,
        websiteUrl,
      ));
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
            <section
              className="onboarding-campaign-task onboarding-discovery-task"
              aria-labelledby="prospect-review-title"
            >
              <div className="onboarding-discovery-content">
                <div className="onboarding-campaign-intro">
                  <h1 id="prospect-review-title" className="onboarding-campaign-heading">
                    Your <span className="whitespace-nowrap">prospects<span className="signup-campaign-period">.</span></span>
                  </h1>
                  <p>Here’s who we’re targeting.</p>
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
                    </div>
                  ))}
                </div>

                <ProspectDetailInput profile={profile} setProfile={setProfile} onContextChange={setAdditionalContext} disabled={saving} />

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
