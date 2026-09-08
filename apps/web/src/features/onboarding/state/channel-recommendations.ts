export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

export type ChannelRecommendationKey =
  | "linkedin"
  | "email"
  | "whatsapp"
  | "instagram"
  | "facebook";

export type ChannelRecommendation = {
  channel: ChannelRecommendationKey;
  label: string;
  confidence: number;
  signalCount: number;
  totalProfiles: number;
  tag: string;
  description: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: JsonValue | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function getRecord(value: JsonValue | undefined): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizeChannel(value: string): ChannelRecommendationKey | null {
  if (value === "linkedin" || value === "email" || value === "whatsapp") {
    return value;
  }
  if (value === "instagram" || value === "facebook") {
    return value;
  }
  if (value === "gmail" || value === "outlook" || value === "mail") {
    return "email";
  }
  return null;
}

/** Parses the `channels` field of a Strategy API response into typed recommendations. */
export function getChannelRecommendations(channelsJson: JsonValue | undefined): ChannelRecommendation[] {
  const channels = getRecord(channelsJson);
  if (!Array.isArray(channels.recommendations)) {
    return [];
  }

  return channels.recommendations.flatMap((item) => {
    if (!isRecord(item)) return [];
    const channel = normalizeChannel(toStringValue(item.channel).toLowerCase());
    if (!channel) return [];

    return [{
      channel,
      label: toStringValue(item.label) || channel,
      confidence: toNumber(item.confidence),
      signalCount: toNumber(item.signalCount),
      totalProfiles: toNumber(item.totalProfiles),
      tag: toStringValue(item.tag),
      description: toStringValue(item.description),
    }];
  });
}
