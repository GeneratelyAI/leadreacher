function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function messageHasVideoAttachment(content: unknown): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  const attachments = (content as { attachments?: unknown }).attachments;
  if (!Array.isArray(attachments)) return false;
  return attachments.some(
    (item) => item && typeof item === "object" && !Array.isArray(item) && (item as { type?: unknown }).type === "video",
  );
}

export function campaignVideoPaused(aiConfig: unknown): boolean {
  const video = asRecord(asRecord(aiConfig)?.video);
  return video?.paused === true;
}

export function pickPrimaryCampaignVideo<T extends { status: string; videoUrl: string | null; thumbnailUrl: string | null }>(
  assets: T[],
): T | null {
  const ready = assets.find(
    (asset) =>
      ["ready", "approved"].includes(asset.status) &&
      Boolean(asset.videoUrl || asset.thumbnailUrl),
  );
  return ready ?? assets[0] ?? null;
}

export function buildPrimaryCampaignVideoSummary(input: {
  aiConfig: unknown;
  assets: Array<{
    id: string;
    status: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    needsReview?: boolean;
    criticScore?: number | null;
  }>;
  template?: {
    id: string;
    status: string;
    needsReview?: boolean;
    criticScore?: number | null;
  } | null;
  outboundContents: unknown[];
}): {
  id: string | null;
  status: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videosSent: number;
  paused: boolean;
  needsReview: boolean;
  criticScore: number | null;
} {
  const asset = pickPrimaryCampaignVideo(input.assets);
  const template = input.template ?? null;
  const videoConfig = asRecord(asRecord(input.aiConfig)?.video);
  const uploadedVideoUrl =
    videoConfig?.enabled === true &&
    videoConfig.source === "uploaded" &&
    typeof videoConfig.uploadedVideoUrl === "string" &&
    videoConfig.uploadedVideoUrl.length > 0
      ? videoConfig.uploadedVideoUrl
      : null;
  const videosSent = input.outboundContents.filter((content) => messageHasVideoAttachment(content)).length;
  return {
    id: asset?.id ?? template?.id ?? null,
    status: asset?.status ?? template?.status ?? (uploadedVideoUrl ? "ready" : "unused"),
    videoUrl: asset?.videoUrl ?? uploadedVideoUrl,
    thumbnailUrl: asset?.thumbnailUrl ?? null,
    videosSent,
    paused: campaignVideoPaused(input.aiConfig),
    needsReview: asset?.needsReview ?? template?.needsReview ?? false,
    criticScore: asset?.criticScore ?? template?.criticScore ?? null,
  };
}
