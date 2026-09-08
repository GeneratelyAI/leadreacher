import { getBrowserSession } from "@/platform/auth/client";
import { announceCampaignSave } from "@/features/onboarding/public/campaign-events";
import { defaultOrgNameFromEmail } from "@/features/organizations/public/naming";
import {
  previewApiFetch,
  previewOrganization,
  usesOnboardingFixtures,
} from "@/features/onboarding/public/preview-api";

import { requestJson } from "@/platform/http/client";
export { ApiError, getAccessToken, clearAccessTokenCache, apiStream, apiBlob } from "@/platform/http/client";

/** Compose preview isolation and campaign events outside the HTTP platform. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const result = usesOnboardingFixtures()
    ? await previewApiFetch<T>(path, options)
    : await requestJson<T>(path, options);
  announceCampaignSave(path, options.method);
  return result;
}

export async function bootstrapOrganization(
  name: string,
  anonScrapeId?: string,
): Promise<{
  orgId: string;
  userId: string;
  subscriptionStatus: string | null;
  onboardedAt: string | null;
  activeChannelCount: number;
  scrapeStatus?: {
    status: "idle" | "running" | "completed" | "failed";
    url: string | null;
    market: string;
    offer: string;
    audience: string;
    value: string;
    strategyStatus: string;
    error: string | null;
  } | null;
}> {
  return apiFetch("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      name,
      ...(anonScrapeId ? { anonScrapeId } : {}),
    }),
  });
}

/**
 * Reuse the authenticated user's workspace name whenever a client onboarding
 * step needs to resolve the current organization. The API is idempotent, so
 * this name only affects a first-time bootstrap.
 */
export async function bootstrapCurrentOrganization(
  anonScrapeId?: string,
) {
  if (usesOnboardingFixtures()) return previewOrganization();
  const session = await getBrowserSession();
  return bootstrapOrganization(
    defaultOrgNameFromEmail(session?.user?.email ?? ""),
    anonScrapeId,
  );
}
