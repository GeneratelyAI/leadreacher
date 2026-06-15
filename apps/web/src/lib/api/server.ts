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
): Promise<{ orgId: string; userId: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/bootstrap`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { orgId: string; userId: string; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Bootstrap failed");
  }

  if (!payload?.orgId || !payload.userId) {
    throw new Error("Bootstrap returned an invalid response");
  }

  return payload;
}
