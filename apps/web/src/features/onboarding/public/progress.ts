import type { ContentChoice } from "@leadreacher/shared/campaign";
import { getOnboardingRouteIndex, type OnboardingRouteId } from "@/features/onboarding/public/navigation";
import { recoverContentChoice } from "@/features/onboarding/public/content-choice";

type JsonRecord = Record<string, unknown>;

export type ResumeStrategy = {
  campaignType: string | null;
  videoConfig: unknown;
  icpDefinition: unknown;
  channels: unknown;
  messagingAngles: unknown;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function incompleteContentRoute(strategy: ResumeStrategy, choice: ContentChoice): OnboardingRouteId | null {
  const video = record(strategy.videoConfig);
  const approved = record(record(strategy.icpDefinition).approvedContent);
  if (choice === "document") return approved.type === "Document" ? null : "document";
  if (choice === "your-video") {
    return video.source === "uploaded" && typeof video.uploadedVideoUrl === "string" && video.uploadedVideoUrl
      ? null
      : "your-video";
  }
  const expectedMode = choice === "ai-video" ? "standardized" : "personalized";
  const tone = video.tone;
  return video.source === "generated" && video.mode === expectedMode &&
    (tone === "professional" || tone === "casual" || tone === "aggressive") ? null : choice;
}

export function selectedChannels(value: unknown): string[] {
  const selected = record(value).selected;
  return Array.isArray(selected)
    ? selected.filter((channel): channel is string => typeof channel === "string" && Boolean(channel.trim()))
    : [];
}

export function messageIsApproved(value: unknown): boolean {
  const messaging = record(value);
  return typeof messaging.outreachMessage === "string" && Boolean(messaging.outreachMessage.trim()) &&
    typeof messaging.outreachMessageApprovedAt === "string" && Boolean(messaging.outreachMessageApprovedAt.trim());
}

export function resolveAllowedOnboardingRoute(requested: OnboardingRouteId, earliestIncomplete: OnboardingRouteId): OnboardingRouteId {
  return getOnboardingRouteIndex(requested) <= getOnboardingRouteIndex(earliestIncomplete) ? requested : earliestIncomplete;
}

export function contentChoiceRoute(strategy: Pick<ResumeStrategy, "campaignType" | "icpDefinition">): ContentChoice {
  return recoverContentChoice({ campaignType: strategy.campaignType ?? undefined, icpDefinition: record(strategy.icpDefinition) });
}

export function resolveOnboardingResumeRoute(input: { strategy: ResumeStrategy | null; subscriptionStatus: string | null | undefined }): OnboardingRouteId {
  if (!input.strategy) return "how-leadreacher-works";
  const onboarding = record(record(input.strategy.icpDefinition).onboarding);
  if (onboarding.introductionSeen !== true) return "how-leadreacher-works";
  if (onboarding.prospectsApproved !== true) return "discovery";
  if (!input.strategy.campaignType) return "campaign-content";
  const incompleteContent = incompleteContentRoute(input.strategy, contentChoiceRoute(input.strategy));
  if (incompleteContent) return incompleteContent;
  if (!messageIsApproved(input.strategy.messagingAngles)) return "cta";
  if (selectedChannels(input.strategy.channels).length === 0) return "channels";
  if (input.subscriptionStatus !== "active" && input.subscriptionStatus !== "trialing") return "checkout";
  return "connect-channels";
}
