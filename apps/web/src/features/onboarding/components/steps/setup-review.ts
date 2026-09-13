import { recoverContentChoice } from "@/features/onboarding/public/content-choice";
import type { JsonValue } from "@/features/onboarding/state/channel-recommendations";
import type { OnboardingRouteId } from "../../public/navigation";

export type ReviewStrategy = {
  campaignType?: string | null;
  channels?: JsonValue;
  icpDefinition?: Record<string, unknown> | null;
  videoConfig?: { tone?: string | null } | null;
};

export type ReviewAccount = {
  platform: string;
  providerType?: string | null;
  accountName: string | null;
  status: string;
};

export type SetupReviewItem = {
  key: "audience" | "content" | "style" | "channels";
  label: string;
  value: string;
  step: OnboardingRouteId;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function values(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/** Review the saved decision record, without manufacturing approval or a draft. */
export function buildSetupReview(
  strategy: ReviewStrategy,
  accounts: ReviewAccount[],
): SetupReviewItem[] {
  const icp = record(strategy.icpDefinition);
  const audience = record(icp.prospectProfile);
  const roles = values(audience.decisionMakers);
  const audienceLabel =
    text(record(icp.discoverySummary).audience) ||
    (roles.length ? roles.join(" · ") : text(icp.idealCustomer));
  const choice = recoverContentChoice({
    campaignType: strategy.campaignType ?? undefined,
    icpDefinition: icp,
  });
  const approved = record(icp.approvedContent);
  const labels = {
    "personalized-video": "Personalized video",
    "ai-video": "AI video",
    "your-video": "Your video",
    document: "Document",
  };
  const contentLabel =
    text(approved.type) ||
    (text(icp.contentChoice) || strategy.campaignType ? labels[choice] : "");
  const tone = text(approved.style) || text(strategy.videoConfig?.tone);
  const styleLabel = tone ? tone.charAt(0).toUpperCase() + tone.slice(1) : "";
  const selectedChannels = values(record(strategy.channels).selected).map((channel) => channel === "email" ? "gmail" : channel);
  const channelNames: Record<string, string> = {
    linkedin: "LinkedIn",
    gmail: "Gmail",
    outlook: "Outlook",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
  };
  const connected = [
    ...new Set(
      accounts
        .flatMap((account) => {
          if (account.status !== "active") return [];
          const platform = account.platform.toLowerCase();
          const provider = account.providerType?.toLowerCase();
          const channel = platform === "email"
            ? provider === "google" || provider === "gmail" ? "gmail"
              : provider === "outlook" || provider === "microsoft" ? "outlook"
                : "email"
            : platform;
          return selectedChannels.includes(channel)
            ? [channelNames[channel] ?? account.platform]
            : [];
        }),
    ),
  ];
  const items: SetupReviewItem[] = [
    {
      key: "audience",
      label: "Audience",
      value: audienceLabel || "No audience saved yet",
      step: "discovery",
    },
    {
      key: "content",
      label: "Content",
      value: contentLabel || "No content selected yet",
      step: "campaign-content",
    },
  ];
  if (choice === "personalized-video" || choice === "ai-video") {
    items.push({
      key: "style",
      label: "Style",
      value: styleLabel || "No style approved yet",
      step:
        choice === "ai-video" ? "ai-video" : "personalized-video",
    });
  }
  items.push({
    key: "channels",
    label: "Channel",
    value: connected.join(" · ") || "No purchased channel connected yet",
    step: "channels",
  });
  return items;
}
