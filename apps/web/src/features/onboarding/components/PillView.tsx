"use client";

import { Check, CheckCircle2, ChevronDown, ChevronRight, Users, Video } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { usePillSectionDisclosure } from "../hooks/usePillSectionDisclosure";
import Image from "next/image";
import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { isOnboardingPreview } from "../public/preview-api";
import mobileStyles from "./MobileOnboarding.module.css";
import { mobileCampaignSections, shortSavedCustomerSegments } from "./mobile-campaign-summary";
import type { PillField, PillSection, PillProps } from "../public/campaign-summary";
import {
  CampaignChannelDetails,
  CampaignChannelMarks,
  campaignChannels,
} from "./CampaignChannelMarks";

function CampaignStyleIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="m12 2 3 6.5 7 .9-5.2 5 1.4 7-6.2-3.5L5.8 21l1.4-6.6L2 9.4l7-.9Z" /></svg>;
}

/** A compact, progressively populated campaign brief for onboarding. */
export function PillView({
  campaign,
  className,
  defaultExpanded = true,
  responsiveDefaultCollapsed = false,
  footer,
}: PillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("business");
  const [mobile, setMobile] = useState(false);
  const [hasToggledResponsiveDisclosure, setHasToggledResponsiveDisclosure] = useState(false);
  const prefersReducedMotion = useStableReducedMotion();
  const params = useSearchParams();
  const summaryTriggerRef = useRef<HTMLButtonElement>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const referenceOpened = useRef(false);
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
  const { expandedSectionId, detailPresentations, sectionListRef, sectionRefs, detailMeasureRefs, detailContainerRefs, expandSection, collapseSection } = usePillSectionDisclosure(sections, mobile, prefersReducedMotion);
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
  const mobileSections = mobileCampaignSections(campaign);

  useEffect(() => {
    if (!mobile || referenceOpened.current || !isOnboardingPreview() || params.get("screen") !== "15") return;
    referenceOpened.current = true;
    setMobileSummaryOpen(true);
  }, [mobile, params]);

  useLayoutEffect(() => {
    if (!responsiveDefaultCollapsed || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 63rem)");
    const syncExpandedState = () => {
      setMobile(query.matches);
      setExpanded(!query.matches);
      if (!query.matches) setMobileSummaryOpen(false);
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

  const visibleFields = fields.slice(0, visibleFieldCount);
  const statusLabel = campaign.status === "learning"
    ? campaign.statusLabel ?? "Understanding your business"
    : isRevealing
      ? "Building your campaign"
      : campaign.statusLabel ?? "Business understood";

  function sectionSummary(section: PillSection) {
    const channels = section.id === "channels" ? campaignChannels(section) : [];
    if (channels.length) {
      return <CampaignChannelMarks channels={channels} />;
    }
    if (section.summary) return section.summary;
    if (section.value) return section.value;
    const firstField = section.fields?.find((field) => field.value || field.values?.length);
    if (!firstField) return "Complete";
    return firstField.value ?? firstField.values?.join(" · ") ?? "Complete";
  }

  function sectionDetails(section: PillSection, fieldCount?: number, mobilePresentation = false) {
    const channels = section.id === "channels" ? campaignChannels(section) : [];
    if (channels.length) return <CampaignChannelDetails channels={channels} />;

    if (section.fields?.length) {
      const fieldsToShow = fieldCount === undefined ? section.fields : section.fields.slice(0, fieldCount);
      return (
        <div className="campaign-pill-section-fields">
          {fieldsToShow.map((field) => {
            const customerValues = mobilePresentation && field.label === "Customers" && field.value ? shortSavedCustomerSegments(field.value) : null;
            const values = field.values ?? customerValues;
            return (
            <div className="campaign-pill-section-field" data-field={field.label.toLowerCase()} key={field.label}>
              <b>{mobilePresentation && field.label === "Customers" ? "Who we help" : field.label}</b>
              {values?.length ? (
                <div className="campaign-pill-customer-values" aria-label={field.label}>
                  {values.map((value) => <span key={value}>{value}</span>)}
                </div>
              ) : field.value ? <span>{field.value}</span> : null}
            </div>
          ); })}
        </div>
      );
    }

    return section.value ? <span className="campaign-pill-section-detail-value">{section.value}</span> : null;
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
      {responsiveDefaultCollapsed ? <button
        ref={summaryTriggerRef}
        type="button"
        className={mobileStyles.disclosure}
        aria-label={campaign.site ? `Open campaign summary for ${site.label}` : "Open campaign summary"}
        aria-expanded={mobileSummaryOpen}
        onClick={() => setMobileSummaryOpen(true)}
      >{campaign.site ? <><strong>{site.label}</strong><span aria-hidden>·</span></> : null}<span>{fields.length || sections.length ? "Your campaign" : campaign.statusLabel ?? "Building your campaign"}</span><ChevronRight className="size-4" aria-hidden /></button> : null}
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
              role="region"
              aria-label="Campaign summary sections"
              tabIndex={0}
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
                        <span className={cn("campaign-pill-section-summary", section.id === "channels" && "campaign-pill-channel-summary")}>{sectionSummary(section)}</span>
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
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {footer}
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
      <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
        <SheetContent side="bottom" className={cn(mobileStyles.sheet, mobileStyles.summarySheet)} overlayClassName={mobileStyles.sheetBackdrop} initialFocus={summaryHeadingRef} finalFocus={summaryTriggerRef}>
          <span className={mobileStyles.handle} aria-hidden />
          <SheetTitle ref={summaryHeadingRef} tabIndex={-1}>Your campaign</SheetTitle>
          <SheetDescription className={mobileStyles.summarySite}>{campaign.site ? site.label : "Your saved decisions will appear here."}</SheetDescription>
          <div>
            {mobileSections.map((section) => {
              const hasDetails = (section.state ?? "complete") === "complete" && Boolean(section.fields?.length || section.value);
              const active = mobileSection === section.id;
              const completed = (section.state ?? "complete") === "complete";
              const channels = section.id === "channels" ? campaignChannels(section) : [];
              const Icon = section.id === "targeting" ? Users : section.id === "content" ? Video : section.id === "style" ? CampaignStyleIcon : CheckCircle2;
              return <section className={mobileStyles.summarySection} data-business={section.id === "business" || undefined} key={section.id}>
                <button type="button" disabled={!hasDetails} aria-expanded={hasDetails ? active : undefined} aria-controls={hasDetails ? `${contentId}-mobile-${section.id}` : undefined} onClick={() => setMobileSection(active ? "" : section.id)}>
                  {completed && section.id === "business" ? <span className={mobileStyles.summaryPrimaryCheck}><Check className="size-6" aria-hidden /></span> : completed ? <Icon className={cn("size-6", section.id === "channels" ? mobileStyles.summaryCheck : mobileStyles.summarySectionIcon)} aria-hidden /> : <span className={mobileStyles.summaryPending} aria-hidden />}
                  <span className={channels.length ? mobileStyles.channelSummary : undefined}>{section.id === "business" && section.summary ? section.summary : channels.length ? <><span>{section.label}</span><CampaignChannelMarks channels={channels} /></> : <>{section.label}{section.summary || section.pendingLabel ? <> · {section.summary ?? section.pendingLabel}</> : null}</>}</span>
                  {completed && section.id !== "business" && section.id !== "channels" ? <CheckCircle2 className={cn("size-4", mobileStyles.summaryCheck)} aria-label="Complete" /> : null}
                  {hasDetails ? <ChevronDown className="size-4" aria-hidden /> : null}
                </button>
                {hasDetails && active ? <div id={`${contentId}-mobile-${section.id}`} className={mobileStyles.summaryDetail}>{sectionDetails(section, undefined, true)}</div> : null}
              </section>;
            })}
            {!mobileSections.length ? <p>{campaign.statusLabel ?? "Building your campaign"}</p> : null}
          </div>
          {footer ? <div className={mobileStyles.summaryFooter}>{footer}</div> : null}
          <SheetClose className={mobileStyles.primary}>Done</SheetClose>
        </SheetContent>
      </Sheet>
    </section>
  );
}
