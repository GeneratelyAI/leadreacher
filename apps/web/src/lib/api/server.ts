function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return baseUrl.replace(/\/$/, "");
}

export async function bootstrapOrganizationServer(
  accessToken: string,
  name: string,
): Promise<{
  orgId: string;
  userId: string;
  role: string;
  subscriptionStatus: string | null;
  onboardedAt: string | null;
  activeChannelCount: number;
  disabledAt: string | null;
  purgeAt: string | null;
  legalAccepted: boolean;
}> {
  const response = await fetch(`${getApiBaseUrl()}/auth/bootstrap`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        orgId: string;
        userId: string;
        role?: string;
        subscriptionStatus?: string | null;
        onboardedAt?: string | null;
        activeChannelCount?: number;
        disabledAt?: string | null;
        purgeAt?: string | null;
        legalAccepted?: boolean;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Bootstrap failed");
  }

  if (!payload?.orgId || !payload.userId) {
    throw new Error("Bootstrap returned an invalid response");
  }

  return {
    orgId: payload.orgId,
    userId: payload.userId,
    role: payload.role ?? "member",
    subscriptionStatus: payload.subscriptionStatus ?? null,
    onboardedAt: payload.onboardedAt ?? null,
    activeChannelCount: payload.activeChannelCount ?? 0,
    disabledAt: payload.disabledAt ?? null,
    purgeAt: payload.purgeAt ?? null,
    legalAccepted: payload.legalAccepted === true,
  };
}

export async function getStrategyServer(
  accessToken: string,
  orgId: string,
): Promise<{
  id: string;
  completedSteps: number[];
  icpDefinition: unknown;
  campaignType: string | null;
  videoConfig: unknown;
} | null> {
  const response = await fetch(`${getApiBaseUrl()}/strategy/${orgId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        id: string;
        completedSteps?: number[];
        icpDefinition?: unknown;
        campaignType?: string | null;
        videoConfig?: unknown;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Strategy lookup failed");
  }

  if (!payload?.id) {
    throw new Error("Strategy lookup returned an invalid response");
  }

  return {
    id: payload.id,
    completedSteps: Array.isArray(payload.completedSteps)
      ? payload.completedSteps
      : [],
    icpDefinition: payload.icpDefinition,
    campaignType: payload.campaignType ?? null,
    videoConfig: payload.videoConfig,
  };
}
