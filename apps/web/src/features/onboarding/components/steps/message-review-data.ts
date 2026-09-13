export type CampaignMedia = {
  id?: string;
  kind: "video" | "document";
  status: "ready" | "processing" | "failed" | "unavailable";
  url?: string;
  previewUrl?: string;
  name?: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeWebsiteUrl(value: unknown): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeAssetUrl(value: unknown): string | undefined {
  return normalizeWebsiteUrl(value) ?? undefined;
}

export function persistedWebsiteUrl(strategy: unknown): string | null {
  const icp = record(record(strategy).icpDefinition);
  const discovery = record(icp.discovery);
  return normalizeWebsiteUrl(discovery.websiteUrl ?? icp.websiteUrl);
}

export function resolveCampaignMedia(strategy: unknown): CampaignMedia | null {
  const root = record(strategy);
  const icp = record(root.icpDefinition);
  const approved = record(icp.approvedContent);
  const video = record(root.videoConfig);
  const creative = record(root.creativeAssets);
  const persistedMedia = record(root.campaignMedia ?? creative.campaignMedia);
  const approvedType = string(approved.type)?.toLowerCase() ?? "";

  if (approvedType.includes("document")) {
    const url = safeAssetUrl(approved.url ?? approved.documentUrl ?? persistedMedia.url);
    const previewUrl = safeAssetUrl(approved.previewUrl ?? persistedMedia.previewUrl ?? persistedMedia.thumbnailUrl);
    const name = string(approved.documentName ?? persistedMedia.name);
    const id = string(approved.id ?? approved.mediaId ?? persistedMedia.id ?? persistedMedia.mediaId);
    return { kind: "document", status: url ? "ready" : "unavailable", url, previewUrl, name, id };
  }

  const source = string(video.source);
  if (!source && !approvedType.includes("video")) return null;
  const url = safeAssetUrl(
    source === "uploaded"
      ? video.uploadedVideoUrl
      : persistedMedia.url ?? persistedMedia.videoUrl ?? video.generatedVideoUrl,
  );
  const previewUrl = safeAssetUrl(persistedMedia.previewUrl ?? persistedMedia.thumbnailUrl ?? video.thumbnailUrl);
  const persistedStatus = string(persistedMedia.status ?? video.status)?.toLowerCase();
  const status = url
    ? "ready"
    : persistedStatus === "failed"
      ? "failed"
      : source === "generated" || ["pending", "processing", "generating"].includes(persistedStatus ?? "")
        ? "processing"
        : "unavailable";
  const id = string(video.uploadedVideoId ?? video.mediaId ?? persistedMedia.id ?? persistedMedia.mediaId);
  return { kind: "video", status, url, previewUrl, id };
}

export function withDefaultWebsiteCta<T extends { ctaLabel: string | null; ctaUrl: string | null; ctaExplicitlySaved?: boolean }>(
  message: T,
  websiteUrl: string | null,
): T {
  if (message.ctaExplicitlySaved || message.ctaLabel || message.ctaUrl || !websiteUrl) return message;
  return { ...message, ctaLabel: "Visit website", ctaUrl: websiteUrl };
}
