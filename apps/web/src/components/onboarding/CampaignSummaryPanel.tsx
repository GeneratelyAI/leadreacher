"use client";

import { Briefcase, Building2, Compass, TrendingUp, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  getCampaignFieldText,
  useCampaignReveal,
  type CampaignFieldKey,
} from "@/hooks/useCampaignReveal";
import type { DiscoverySummary } from "@/hooks/useDiscovery";
import { useAnimatedHeight, useTypewriterText } from "@/hooks/useTypewriterText";

const SUMMARY_ITEMS = [
  {
    key: "businessModel" as const,
    title: "Business model",
    icon: Briefcase,
  },
  {
    key: "industry" as const,
    title: "Industry",
    icon: Building2,
  },
  {
    key: "strengths" as const,
    title: "Strengths",
    icon: TrendingUp,
  },
  {
    key: "idealCustomer" as const,
    title: "Ideal customer",
    icon: User,
  },
  {
    key: "nextStep" as const,
    title: "Next step",
    icon: Compass,
  },
] as const;

type SummaryFieldKey = (typeof SUMMARY_ITEMS)[number]["key"];

function hasSummaryContent(
  summary: DiscoverySummary,
  key: SummaryFieldKey,
): boolean {
  return summary[key].trim().length > 0;
}

export function countPopulatedSummaryFields(summary: DiscoverySummary): number {
  return SUMMARY_ITEMS.filter((item) => hasSummaryContent(summary, item.key))
    .length;
}

function CampaignCardSkeleton({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      className={`discovery-campaign-skeleton ${
        exiting ? "discovery-campaign-skeleton--exit" : ""
      }`}
      aria-hidden
    >
      <div className="discovery-campaign-skeleton__line" />
    </div>
  );
}

function CampaignAnimatedBody({
  watchKey,
  children,
}: {
  phase: "skeleton" | "revealing" | "done";
  watchKey?: unknown;
  children: ReactNode;
}) {
  const { innerRef, height } = useAnimatedHeight<HTMLDivElement>(watchKey);

  return (
    <div
      className="discovery-campaign-card__expand overflow-hidden"
      style={{
        height: height > 0 ? `${height}px` : undefined,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function CampaignSummaryTextField({
  targetText,
  speedMs,
  phase,
  textVariant,
  onComplete,
}: {
  targetText: string;
  speedMs: number;
  phase: "skeleton" | "revealing" | "done";
  textVariant: "default" | "idealCustomer" | "nextStep";
  onComplete: () => void;
}) {
  const isDone = phase === "done";
  const isRevealing = phase === "revealing";
  const [contentVisible, setContentVisible] = useState(isDone);

  useEffect(() => {
    let timer: number | undefined;

    if (isDone) {
      timer = window.setTimeout(() => setContentVisible(true), 0);
      return () => window.clearTimeout(timer);
    }

    if (!isRevealing) {
      timer = window.setTimeout(() => setContentVisible(false), 0);
      return () => window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => setContentVisible(true), 280);
    return () => window.clearTimeout(timer);
  }, [isDone, isRevealing]);

  const { text } = useTypewriterText(targetText, speedMs, {
    enabled: isRevealing && contentVisible,
    showImmediately: isDone,
    onComplete,
  });

  return (
    <CampaignAnimatedBody phase={phase} watchKey={`${phase}-${text}`}>
      {phase === "skeleton" || (isRevealing && !contentVisible) ? (
        <CampaignCardSkeleton exiting={isRevealing} />
      ) : (
        <p
          className={`discovery-campaign-card__value discovery-campaign-value apple-glass-panel__value text-neutral-700 ${
            textVariant === "nextStep"
              ? "text-xs leading-4"
              : "text-xs leading-relaxed"
          }`}
        >
          {text || "\u00a0"}
        </p>
      )}
    </CampaignAnimatedBody>
  );
}

function CampaignSummaryCard({
  item,
  summary,
  phase,
  onComplete,
  websiteEnriched,
}: {
  item: (typeof SUMMARY_ITEMS)[number];
  summary: DiscoverySummary;
  phase: "skeleton" | "revealing" | "done";
  onComplete: () => void;
  websiteEnriched: boolean;
}) {
  const Icon = item.icon;
  const showAnalyzedBadge =
    item.key === "nextStep" &&
    websiteEnriched &&
    (phase === "revealing" || phase === "done");
  const showAnalyzingLabel = phase === "skeleton";

  return (
    <div className="discovery-campaign-card apple-glass-panel__row flex items-start gap-3 border-b border-white/20 px-4 py-3.5 last:border-b-0">
      <span className="apple-glass-panel__chip inline-flex size-8 shrink-0 items-center justify-center rounded-xl">
        <Icon
          className="discovery-campaign-card__icon size-4"
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="discovery-campaign-title flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-900">
          <span>{item.title}</span>
          {showAnalyzedBadge ? (
            <span className="text-xs font-medium text-emerald-600">
              Analyzed ✓
            </span>
          ) : null}
        </p>
        {showAnalyzingLabel ? (
          <p className="discovery-campaign-status discovery-campaign-card__status mt-0.5 text-xs font-medium text-neutral-400">
            Analyzing...
          </p>
        ) : null}
        <div className={showAnalyzingLabel ? "mt-2" : "mt-1.5"}>
          <CampaignSummaryTextField
            targetText={getCampaignFieldText(summary, item.key)}
            speedMs={item.key === "nextStep" ? 45 : 30}
            phase={phase}
            textVariant={
              item.key === "nextStep"
                ? "nextStep"
                : item.key === "idealCustomer"
                  ? "idealCustomer"
                  : "default"
            }
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}

export function CampaignSummaryPanel({
  summary,
}: {
  summary: DiscoverySummary;
}) {
  const { getPhase, completeField, websiteEnriched } = useCampaignReveal(summary);

  return (
    <div className="discovery-campaign-panel__rows">
      {SUMMARY_ITEMS.map((item) => (
        <CampaignSummaryCard
          key={item.key}
          item={item}
          summary={summary}
          phase={getPhase(item.key as CampaignFieldKey)}
          onComplete={() => completeField(item.key as CampaignFieldKey)}
          websiteEnriched={websiteEnriched}
        />
      ))}
    </div>
  );
}
