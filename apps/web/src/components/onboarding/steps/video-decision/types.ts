import type { Dispatch, SetStateAction } from "react";

export type CampaignGoal =
  | "personalized_outreach"
  | "ai_video_ad"
  | "uploaded_video";

export type VideoMode = "personalized" | "standardized";
export type VideoSource = "generated" | "uploaded";
export type VideoTone = "professional" | "casual" | "aggressive";

export type VideoConfig = {
  enabled: boolean;
  mode: VideoMode | null;
  source: VideoSource | null;
  tone: VideoTone | null;
  uploadedVideoUrl: string | null;
};

export type SetVideoConfig = Dispatch<SetStateAction<VideoConfig>>;
