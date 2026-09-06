"use client";

import { Check, CheckCircle2, ChevronDown, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { createContext, useContext, useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { OnboardingLogo } from "./OnboardingLogo";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { createSemanticCampaignSummary } from "./campaign-summary";

export type PillField = {
  label: string;
  value: string;
};

export type PillSection = {
  id: "business" | "targeting" | "content" | "outreach" | "customers";
  label: string;
  value: string;
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
  const [campaign, setCampaign] = useState<PillData>({ fields: [], status: "learning" });
  const approvedContent = useRef<PillSection | undefined>(undefined);
  const approvedTargeting = useRef<PillSection | undefined>(undefined);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  useLayoutEffect(() => {
    setCampaign((current) => {
      if (current.fields.length || current.sections?.length) return current;
      const summary = createSemanticCampaignSummary(status, undefined, websiteUrl);
      if (!summary.sections?.length) return current;
      return {
        ...summary,
        sections: approvedContent.current ? [...summary.sections, approvedContent.current] : summary.sections,
      };
    });
  }, [status, websiteUrl]);
  const publish = useMemo(() => (next: PillData) => setCampaign((previous) => {
    if (next.newlyCompletedSectionId === "targeting") {
      approvedTargeting.current = next.sections?.find((section) => section.id === "targeting");
    }
    const newlyApproved = next.newlyCompletedSectionId === "content"
      ? next.sections?.find((section) => section.id === "content")
      : undefined;
    if (newlyApproved) approvedContent.current = newlyApproved;
    const approved = approvedContent.current;
    const sections = next.sections?.length && approved && !next.sections.some((section) => section.id === "content")
      ? [...next.sections, approved]
      : next.sections;
    const merged = {
      ...next,
      newlyCompletedSectionId: next.newlyCompletedSectionId ?? previous.newlyCompletedSectionId,
      sections: sections?.map((section) => section.id === "targeting" && approvedTargeting.current ? approvedTargeting.current : section),
    };
    return JSON.stringify(previous) === JSON.stringify(merged) ? previous : merged;
  }), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const saved = await apiFetch<{ videoConfig?: { enabled?: boolean; source?: string; mode?: string; tone?: string; uploadedVideoUrl?: string } }>(`/strategy/${orgId}`);
        if (cancelled || approvedContent.current) return;
        const config = saved.videoConfig;
        const tone = config?.tone;
        if (!config?.enabled || !tone || !["professional", "casual", "aggressive"].includes(tone)) return;
        const section: PillSection = {
          id: "content",
          label: "Content",
          value: `${config.mode === "personalized" ? "Personalized video" : "AI video"} · ${tone[0]!.toUpperCase()}${tone.slice(1)}`,
        };
        approvedContent.current = section;
        setCampaign((current) => current.sections?.length
          ? { ...current, sections: [...current.sections.filter((item) => item.id !== "content"), section] }
          : current);
      } catch {
        // The active screen owns authentication and API error recovery.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <CampaignHost.Provider value={publish}>
      <CampaignData.Provider value={campaign}>
      <div className="onboarding-campaign-scene">
        <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor onboarding-persistent-logo inline-flex">
          <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
        </Link>
        {children}
        <aside className="signup-campaign-pill-column onboarding-persistent-pill" aria-label="Live campaign summary">
          <PillView campaign={campaign} className="signup-campaign-pill" />
        </aside>
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
}: PillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(reducedMotionPreferred);
  const contentId = useId();
  const serializedFields = JSON.stringify(campaign.fields);
  const fields = useMemo<PillField[]>(() => JSON.parse(serializedFields), [serializedFields]);
  const serializedSections = JSON.stringify(campaign.sections ?? []);
  const sections = useMemo<PillSection[]>(() => JSON.parse(serializedSections), [serializedSections]);
  const isTimeline = sections.length > 0;
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

  const visibleFields = fields.slice(0, visibleFieldCount);
  const statusLabel = campaign.status === "learning"
    ? campaign.statusLabel ?? "Understanding your business"
    : isRevealing
      ? "Building your campaign"
      : campaign.statusLabel ?? "Business understood";

  return (
    <section
      className={cn(
        "campaign-pill",
        isTimeline && "campaign-pill-semantic",
        expanded && "campaign-pill-expanded",
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
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown className="size-5" aria-hidden />
        </button>
      </header>

      {!isTimeline ? (
        <div className="campaign-pill-status" aria-live="polite">
          <span className={cn("campaign-pill-status-icon", isLearning && "campaign-pill-status-icon-learning")} aria-hidden>
            {isLearning ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" weight="bold" />}
          </span>
          <span>{statusLabel}</span>
        </div>
      ) : null}

      <div id={contentId} className="campaign-pill-body" aria-hidden={!expanded}>
        {isTimeline ? (
          <div className="campaign-pill-sections">
            <div className="campaign-pill-section-list">
              {sections.map((section) => (
                <div
                  className={cn(
                    "campaign-pill-section",
                    section.id === campaign.newlyCompletedSectionId && "campaign-pill-section-new",
                  )}
                  key={`${section.id}:${section.value}`}
                >
                  <p>
                    {section.label}
                    <CheckCircle2 className="size-4" weight="fill" aria-hidden />
                  </p>
                  <span>{section.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="campaign-pill-fields">
            {visibleFields.map((field) => (
              <div
                className="campaign-pill-field"
                key={`${field.label}:${field.value}`}
              >
                <p>{field.label}</p>
                <span>{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
