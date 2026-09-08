"use client";

import { Check, CheckCircle2, ChevronDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { createContext, useContext, useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { OnboardingLogo } from "./OnboardingLogo";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { createConfirmedCampaignSummary, type SavedCampaignSummary } from "./campaign-summary";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { CAMPAIGN_SAVED_EVENT } from "@/lib/onboarding/campaign-events";

export type PillField = {
  label: string;
  value?: string;
  values?: string[];
};

export type PillSection = {
  id: string;
  label: string;
  summary?: string;
  value?: string;
  fields?: PillField[];
  state?: "complete" | "pending" | "future";
  pendingLabel?: string;
};

export type PillData = {
  status?: "learning" | "ready";
  statusLabel?: string;
  fields: PillField[];
  sections?: PillSection[];
  newlyCompletedSectionId?: PillSection["id"];
  site?: {
    label: string;
    iconUrl: string;
  };
};

type PillProps = {
  campaign: PillData;
  className?: string;
  defaultExpanded?: boolean;
  /** Keeps the shared summary compact before a phone user explicitly opens it. */
  responsiveDefaultCollapsed?: boolean;
};

type DetailPresentation = {
  height: number;
  fieldCount?: number;
};

const CampaignHost = createContext<((campaign: PillData) => void) | null>(null);
const CampaignData = createContext<PillData | null>(null);

export function useCampaignData() {
  return useContext(CampaignData);
}

export function useCampaignConfirmation() {
  return useContext(CampaignHost);
}

/** The host remains mounted while route-owned content changes. */
export function CampaignCanvas({ children }: { children: ReactNode }) {
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
  const campaign = useMemo(() => createConfirmedCampaignSummary(status, saved?.websiteUrl === websiteUrl ? saved.campaign : null, websiteUrl), [status, saved, websiteUrl]);
  // Legacy task publishers remain supported without deriving approval from a route.
  const publish = useMemo(() => () => {}, []);

  return (
    <CampaignHost.Provider value={publish}>
      <CampaignData.Provider value={campaign}>
      <div className="onboarding-campaign-scene">
        <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor onboarding-persistent-logo inline-flex">
          <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
        </Link>
        <aside className="signup-campaign-pill-column onboarding-persistent-pill" aria-label="Live campaign summary">
          <PillView
            campaign={campaign}
            className="signup-campaign-pill"
            responsiveDefaultCollapsed
          />
        </aside>
        {children}
      </div>
      </CampaignData.Provider>
    </CampaignHost.Provider>
  );
}

export function Pill(props: PillProps) {
  const publish = useContext(CampaignHost);
  const signature = JSON.stringify(props.campaign);
  useLayoutEffect(() => {
    if (publish) publish(JSON.parse(signature) as PillData);
  }, [publish, signature]);
  return publish ? null : <PillView {...props} />;
}

function reducedMotionPreferred() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A compact, progressively populated campaign brief for onboarding. */
function PillView({
  campaign,
  className,
  defaultExpanded = true,
  responsiveDefaultCollapsed = false,
}: PillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [mobile, setMobile] = useState(false);
  const [hasToggledResponsiveDisclosure, setHasToggledResponsiveDisclosure] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(reducedMotionPreferred);
  const contentId = useId();
  const serializedFields = JSON.stringify(campaign.fields);
  const fields = useMemo<PillField[]>(() => JSON.parse(serializedFields), [serializedFields]);
  const serializedSections = JSON.stringify(campaign.sections ?? []);
  const sections = useMemo<PillSection[]>(() => JSON.parse(serializedSections), [serializedSections]);
  const isTimeline = sections.length > 0;
  const isDenseTimeline = sections.length >= 3;
  const sectionStateSignature = sections.map((section) => `${section.id}:${section.state ?? "complete"}`).join("|");
  const sectionVisualSignature = JSON.stringify(sections.map((section) => ({
    id: section.id,
    state: section.state ?? "complete",
    summary: section.summary,
    value: section.value,
    fields: section.fields,
    pendingLabel: section.pendingLabel,
  })));
  const previousSectionStates = useRef<Record<string, string>>({});
  const previousSectionDetails = useRef<Record<string, string>>({});
  const hasInitializedSectionStates = useRef(false);
  const [enteringSectionIds, setEnteringSectionIds] = useState<Set<string>>(() => new Set());
  const [newlyCompletedSectionId, setNewlyCompletedSectionId] = useState<string | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [fullDetailSection, setFullDetailSection] = useState<PillSection | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (fullDetailSection) dialogRef.current?.showModal(); }, [fullDetailSection]);
  const [detailPresentations, setDetailPresentations] = useState<Record<string, DetailPresentation>>({});
  const sectionListRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pointerLeaveTimeoutRef = useRef<number | null>(null);
  const [reveal, setReveal] = useState(() => ({ signature: serializedFields, count: 0 }));
  const visibleFieldCount = campaign.status === "ready"
    ? fields.length
    : reveal.signature === serializedFields
      ? reveal.count
      : 0;
  const isRevealing = !isTimeline && campaign.status !== "ready" && visibleFieldCount < fields.length;
  const isLearning = campaign.status === "learning" || isRevealing;
  const site = campaign.site ?? {
    label: "leadreacher.ai",
    iconUrl: "/logo/leadreacher_icon_colored.svg",
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", syncPreference);
    return () => query.removeEventListener("change", syncPreference);
  }, []);

  useLayoutEffect(() => {
    if (!responsiveDefaultCollapsed || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 63rem)");
    const syncExpandedState = () => {
      setMobile(query.matches);
      setExpanded(!query.matches);
    };
    syncExpandedState();
    query.addEventListener("change", syncExpandedState);
    return () => query.removeEventListener("change", syncExpandedState);
  }, [responsiveDefaultCollapsed]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setReveal({ signature: serializedFields, count: fields.length });
      return;
    }

    setReveal({ signature: serializedFields, count: 0 });
    const timers = fields.map((_, index) => window.setTimeout(
      () => setReveal((current) => (
        current.signature === serializedFields
          ? { ...current, count: index + 1 }
          : current
      )),
      320 + index * 720,
    ));

    return () => timers.forEach(window.clearTimeout);
  }, [fields, prefersReducedMotion, serializedFields]);

  useLayoutEffect(() => {
    const nextStates = Object.fromEntries(sections.map((section) => [section.id, section.state ?? "complete"]));
    const nextDetails = Object.fromEntries(sections.map((section) => [section.id, JSON.stringify({
      state: section.state ?? "complete",
      summary: section.summary,
      value: section.value,
      fields: section.fields,
      pendingLabel: section.pendingLabel,
    })]));
    if (!hasInitializedSectionStates.current || (!Object.keys(previousSectionStates.current).length && Object.keys(nextStates).length)) {
      hasInitializedSectionStates.current = true;
      previousSectionStates.current = nextStates;
      previousSectionDetails.current = nextDetails;
      return;
    }

    const changedSectionIds = Object.keys(nextDetails).filter((id) => previousSectionDetails.current[id] !== nextDetails[id]);
    const completionChanged = campaign.newlyCompletedSectionId;
    const completedNow = completionChanged
      && nextStates[completionChanged] === "complete"
      && previousSectionStates.current[completionChanged] !== "complete"
      ? completionChanged
      : null;
    previousSectionStates.current = nextStates;
    previousSectionDetails.current = nextDetails;
    setNewlyCompletedSectionId(completedNow);

    if (prefersReducedMotion || !changedSectionIds.length) return;
    setEnteringSectionIds(new Set(changedSectionIds));
    const timeout = window.setTimeout(() => setEnteringSectionIds(new Set()), 300);
    return () => window.clearTimeout(timeout);
  }, [campaign.newlyCompletedSectionId, prefersReducedMotion, sectionStateSignature, sectionVisualSignature, sections]);

  useEffect(() => () => {
    if (pointerLeaveTimeoutRef.current !== null) window.clearTimeout(pointerLeaveTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (expandedSectionId && !sections.some((section) => section.id === expandedSectionId)) {
      setExpandedSectionId(null);
    }
  }, [expandedSectionId, sections]);

  const visibleFields = fields.slice(0, visibleFieldCount);
  const statusLabel = campaign.status === "learning"
    ? campaign.statusLabel ?? "Understanding your business"
    : isRevealing
      ? "Building your campaign"
      : campaign.statusLabel ?? "Business understood";

  function sectionSummary(section: PillSection): string {
    if (section.summary) return section.summary;
    if (section.value) return section.value;
    const firstField = section.fields?.find((field) => field.value || field.values?.length);
    if (!firstField) return "Complete";
    return firstField.value ?? firstField.values?.join(" · ") ?? "Complete";
  }

  function sectionDetails(section: PillSection, fieldCount?: number) {
    if (section.fields?.length) {
      const fieldsToShow = fieldCount === undefined ? section.fields : section.fields.slice(0, fieldCount);
      return (
        <div className="campaign-pill-section-fields">
          {fieldsToShow.map((field) => (
            <div className="campaign-pill-section-field" data-field={field.label.toLowerCase()} key={field.label}>
              <b>{field.label}</b>
              {field.values?.length ? (
                <div className="campaign-pill-customer-values" aria-label={field.label}>
                  {field.values.map((value) => <span key={value}>{value}</span>)}
                </div>
              ) : field.value ? <span>{field.value}</span> : null}
            </div>
          ))}
        </div>
      );
    }

    return section.value ? <span className="campaign-pill-section-detail-value">{section.value}</span> : null;
  }

  function clearPointerLeaveTimeout() {
    if (pointerLeaveTimeoutRef.current !== null) {
      window.clearTimeout(pointerLeaveTimeoutRef.current);
      pointerLeaveTimeoutRef.current = null;
    }
  }

  function measureDetailPresentation(sectionId: string): DetailPresentation {
    const list = sectionListRef.current;
    const detail = detailMeasureRefs.current[sectionId];
    if (!list || !detail) return { height: 0 };

    const compactSectionHeight = Object.entries(sectionRefs.current).reduce((total, [id, section]) => {
      if (!section) return total;
      const visibleDetail = detailContainerRefs.current[id];
      const detailHeight = visibleDetail?.offsetHeight ?? 0;
      const detailMargin = detailHeight > 0 && visibleDetail
        ? Number.parseFloat(window.getComputedStyle(visibleDetail).marginTop) || 0
        : 0;
      return total + section.offsetHeight - detailHeight - detailMargin;
    }, 0);
    const availableHeight = Math.max(0, list.clientHeight - compactSectionHeight);
    const naturalHeight = detail.scrollHeight;
    if (mobile) return { height: naturalHeight };

    if (naturalHeight <= availableHeight) return { height: naturalHeight };

    const fieldElements = Array.from(detail.querySelectorAll<HTMLElement>(".campaign-pill-section-field"));
    const fieldCount = fieldElements.reduce((count, field, index) => {
      const height = field.offsetTop + field.offsetHeight;
      return height <= availableHeight - 44 ? index + 1 : count;
    }, 0);
    if (fieldCount > 0) {
      const finalField = fieldElements[fieldCount - 1];
      return { height: finalField.offsetTop + finalField.offsetHeight + 44, fieldCount };
    }

    return { height: Math.min(44, availableHeight), fieldCount: 0 };
  }

  function expandSection(sectionId: string) {
    clearPointerLeaveTimeout();
    const presentation = measureDetailPresentation(sectionId);
    setDetailPresentations((current) => ({ ...current, [sectionId]: presentation }));
    setExpandedSectionId(presentation.height > 0 ? sectionId : null);
  }

  function collapseSection(sectionId: string, withPointerGrace = false) {
    clearPointerLeaveTimeout();
    const close = () => setExpandedSectionId((current) => current === sectionId ? null : current);
    if (prefersReducedMotion || !withPointerGrace) {
      close();
      return;
    }
    pointerLeaveTimeoutRef.current = window.setTimeout(close, 100);
  }

  return (
    <section
      className={cn(
        "campaign-pill",
        responsiveDefaultCollapsed && "campaign-pill-responsive-disclosure",
        hasToggledResponsiveDisclosure && "campaign-pill-responsive-disclosure-toggled",
        isTimeline && "campaign-pill-semantic",
        expanded && "campaign-pill-expanded",
        expandedSectionId && "campaign-pill-section-is-expanded",
        className,
      )}
      aria-label="Your campaign"
    >
      <div className="campaign-pill-ambient" aria-hidden />
      <div className="campaign-pill-site" aria-label={`Website: ${site.label}`}>
        <Image
          src={site.iconUrl}
          alt=""
          width={32}
          height={32}
          className="campaign-pill-site-icon"
        />
        <span className="campaign-pill-site-url">{site.label}</span>
      </div>
      <header className="campaign-pill-header">
        <p className="campaign-pill-title">Your campaign</p>
        <button
          type="button"
          className="campaign-pill-toggle"
          aria-label={expanded ? "Collapse your campaign" : "Expand your campaign"}
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => {
            setHasToggledResponsiveDisclosure(true);
            setExpanded((current) => !current);
          }}
        >
          <ChevronDown className="size-5" aria-hidden />
        </button>
      </header>

      {isTimeline && !expanded ? (
        <p className="campaign-pill-mobile-context">
          {sections.find((section) => section.state === "pending")?.pendingLabel
            ?? sections.filter((section) => section.state === "complete").at(-1)?.summary
            ?? "Campaign ready for your next step"}
        </p>
      ) : null}

      {!isTimeline ? (
        <div className="campaign-pill-status" aria-live="polite">
          <span className={cn("campaign-pill-status-icon", isLearning && "campaign-pill-status-icon-learning")} aria-hidden>
            {isLearning ? <span className="campaign-pill-status-orbit" /> : <Check className="size-4" weight="bold" />}
          </span>
          <span>{statusLabel}</span>
        </div>
      ) : null}

      <div id={contentId} className="campaign-pill-body" aria-hidden={!expanded} inert={!expanded}>
        {isTimeline ? (
          <div className="campaign-pill-sections">
            <div
              className={cn("campaign-pill-section-list", isDenseTimeline && "campaign-pill-section-list-dense")}
              ref={sectionListRef}
            >
              {sections.map((section) => {
                const state = section.state ?? "complete";
                const entering = enteringSectionIds.has(section.id);
                const isSectionExpanded = expandedSectionId === section.id;
                const isExpandable = state === "complete" && Boolean(section.fields?.length || section.value);
                const detailPresentation = detailPresentations[section.id];
                return (
                  <div
                    className={cn(
                      "campaign-pill-section",
                      state === "pending" && "campaign-pill-section-pending",
                      state === "future" && "campaign-pill-section-future",
                      isSectionExpanded && "campaign-pill-section-expanded",
                      entering && "campaign-pill-section-entering",
                      section.id === newlyCompletedSectionId && "campaign-pill-section-new",
                    )}
                    key={section.id}
                    tabIndex={isExpandable && !mobile ? 0 : undefined}
                    data-campaign-section-id={section.id}
                    data-campaign-expandable={isExpandable || undefined}
                    ref={(node) => { sectionRefs.current[section.id] = node; }}
                    onMouseEnter={isExpandable && !mobile ? () => expandSection(section.id) : undefined}
                    onMouseLeave={isExpandable && !mobile ? () => collapseSection(section.id, true) : undefined}
                    onFocus={isExpandable && !mobile ? () => expandSection(section.id) : undefined}
                    onBlur={isExpandable && !mobile ? (event) => {
                      const nextSection = (event.relatedTarget as HTMLElement | null)
                        ?.closest<HTMLElement>("[data-campaign-expandable]");
                      if (nextSection?.dataset.campaignSectionId) {
                        expandSection(nextSection.dataset.campaignSectionId);
                      } else if (!event.currentTarget.contains(event.relatedTarget)) collapseSection(section.id);
                    } : undefined}
                  >
                    <p>
                      {isExpandable && mobile ? <button
                        type="button"
                        className="campaign-pill-section-heading"
                        aria-expanded={isSectionExpanded}
                        aria-controls={`${contentId}-${section.id}`}
                        onClick={() => isSectionExpanded ? collapseSection(section.id) : expandSection(section.id)}
                      >{section.label}<CheckCircle2 className="size-4" weight="fill" aria-hidden /></button> : <>
                      {section.label}
                      {state === "complete"
                        ? <CheckCircle2 className="size-4" weight="fill" aria-hidden />
                        : <span className="campaign-pill-pending-indicator" aria-hidden />}
                      </>}
                    </p>
                    {state === "pending" ? (
                      <div className="campaign-pill-pending" role="status" aria-live="polite">
                        <span>{section.pendingLabel ?? "Preparing"}</span>
                        <div className="campaign-pill-pending-lines" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    ) : state === "future" ? (
                      <span className="campaign-pill-section-next">{section.pendingLabel ?? "Next"}</span>
                    ) : (
                      <>
                        <span className="campaign-pill-section-summary">{sectionSummary(section)}</span>
                        <div
                          aria-hidden
                          className="campaign-pill-section-detail-measure"
                          ref={(node) => { detailMeasureRefs.current[section.id] = node; }}
                        >
                          {sectionDetails(section)}
                        </div>
                        <div
                          id={`${contentId}-${section.id}`}
                          className="campaign-pill-section-details"
                          aria-hidden={!isSectionExpanded}
                          inert={!isSectionExpanded}
                          ref={(node) => { detailContainerRefs.current[section.id] = node; }}
                          style={{ "--campaign-pill-detail-height": `${detailPresentation?.height ?? 0}px` } as CSSProperties}
                        >
                          <div>
                            {sectionDetails(section, detailPresentation?.fieldCount)}
                            {detailPresentation?.fieldCount !== undefined ? <button type="button" className="campaign-pill-all-details" onClick={() => setFullDetailSection(section)}>View all {section.label.toLowerCase()} details</button> : null}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="campaign-pill-fields">
            {visibleFields.map((field) => (
              <div
                className="campaign-pill-field"
                data-field={field.label.toLowerCase()}
                key={`${field.label}:${field.value}`}
              >
                <p>{field.label}</p>
                {field.values?.length ? (
                  <div className="campaign-pill-customer-values" aria-label={field.label}>
                    {field.values.map((value) => <span key={value}>{value}</span>)}
                  </div>
                ) : field.value ? <span>{field.value}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {fullDetailSection && typeof document !== "undefined" ? createPortal(
        <dialog ref={dialogRef} className="campaign-full-details-dialog" aria-labelledby={`${contentId}-full-title`} onCancel={() => setFullDetailSection(null)} onClose={() => setFullDetailSection(null)}>
          <header><h2 id={`${contentId}-full-title`}>{fullDetailSection.label}</h2><button type="button" autoFocus onClick={() => { dialogRef.current?.close(); setFullDetailSection(null); }}>Close</button></header>
          {sectionDetails(fullDetailSection)}
        </dialog>, document.body,
      ) : null}
    </section>
  );
}
