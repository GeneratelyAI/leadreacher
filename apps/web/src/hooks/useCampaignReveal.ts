"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverySummary } from "@/hooks/useDiscovery";

export const CAMPAIGN_FIELD_ORDER = [
  "businessModel",
  "industry",
  "strengths",
  "idealCustomer",
  "nextStep",
] as const;

export type CampaignFieldKey = (typeof CAMPAIGN_FIELD_ORDER)[number];
export type CampaignCardPhase = "skeleton" | "revealing" | "done";

function createInitialPhases(): Record<CampaignFieldKey, CampaignCardPhase> {
  return {
    businessModel: "skeleton",
    industry: "skeleton",
    strengths: "skeleton",
    idealCustomer: "skeleton",
    nextStep: "skeleton",
  };
}

export function hasCampaignFieldContent(
  summary: DiscoverySummary,
  key: CampaignFieldKey,
): boolean {
  return summary[key].trim().length > 0;
}

export function formatCampaignDisplayText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const capitalize = (value: string) =>
    value.length > 0
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;

  let formatted = capitalize(trimmed);
  formatted = formatted.replace(
    /([.!?]\s+)([a-z])/g,
    (_, punctuation: string, letter: string) => punctuation + letter.toUpperCase(),
  );

  return formatted;
}

export function getCampaignFieldText(
  summary: DiscoverySummary,
  key: CampaignFieldKey,
): string {
  return formatCampaignDisplayText(summary[key]);
}

export function useCampaignReveal(summary: DiscoverySummary) {
  const [phases, setPhases] =
    useState<Record<CampaignFieldKey, CampaignCardPhase>>(createInitialPhases);
  const summaryRef = useRef(summary);
  const phasesRef = useRef(phases);

  const advanceQueue = useCallback(() => {
    const currentSummary = summaryRef.current;
    const currentPhases = phasesRef.current;

    const revealingKey = CAMPAIGN_FIELD_ORDER.find(
      (key) => currentPhases[key] === "revealing",
    );
    if (revealingKey) {
      return;
    }

    const nextKey = CAMPAIGN_FIELD_ORDER.find(
      (key) => currentPhases[key] === "skeleton",
    );
    if (!nextKey) {
      return;
    }

    if (!hasCampaignFieldContent(currentSummary, nextKey)) {
      return;
    }

    setPhases((current) => ({
      ...current,
      [nextKey]: "revealing",
    }));
  }, []);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    advanceQueue();
  }, [summary, advanceQueue]);

  const completeField = useCallback((key: CampaignFieldKey) => {
    setPhases((current) => {
      if (current[key] !== "revealing") {
        return current;
      }

      return { ...current, [key]: "done" };
    });
  }, []);

  useEffect(() => {
    phasesRef.current = phases;
    advanceQueue();
  }, [phases, advanceQueue]);

  const getPhase = useCallback(
    (key: CampaignFieldKey) => phases[key],
    [phases],
  );

  const isRevealing = useCallback(
    (key: CampaignFieldKey) => phases[key] === "revealing",
    [phases],
  );

  return {
    getPhase,
    isRevealing,
    completeField,
    websiteEnriched: summary.websiteEnriched,
  };
}
