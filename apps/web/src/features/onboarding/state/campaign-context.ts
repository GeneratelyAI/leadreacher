"use client";

import { createContext, useContext } from "react";
import type { PillData } from "../public/campaign-summary";

export const CampaignData = createContext<PillData | null>(null);

export type CampaignPillDraft = {
  sectionId: string;
  summary: string;
  value?: string;
};

type CampaignDraftActions = {
  draft: CampaignPillDraft | null;
  setDraft: (draft: CampaignPillDraft) => void;
  clearDraft: () => void;
};

export const CampaignDraft = createContext<CampaignDraftActions | null>(null);

export function useCampaignData() {
  return useContext(CampaignData);
}

/** Ephemeral pill state used while a step is being edited, never persisted. */
export function useCampaignPillDraft() {
  const value = useContext(CampaignDraft);
  if (!value) throw new Error("useCampaignPillDraft must be used within CampaignCanvas");
  return value;
}
