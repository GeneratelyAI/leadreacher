"use client";

import { createContext, useContext } from "react";
import type { PillData } from "../public/campaign-summary";

export const CampaignData = createContext<PillData | null>(null);

export function useCampaignData() {
  return useContext(CampaignData);
}
