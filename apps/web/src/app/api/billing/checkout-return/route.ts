import { NextResponse } from "next/server";
import { createClient } from "@/platform/auth/server";

function checkoutUrl(origin: string, sessionId: string | null): URL {
  const url = new URL("/onboarding/checkout", origin);
  url.searchParams.set("status", "success");
  if (sessionId) url.searchParams.set("session_id", sessionId);
  return url;
}

function hasUsableSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const fallback = checkoutUrl(origin, sessionId);

  if (!sessionId?.startsWith("cs_")) {
    return NextResponse.redirect(fallback);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiUrl) return NextResponse.redirect(fallback);

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.redirect(fallback);

  try {
    const response = await fetch(`${apiUrl}/billing/checkout-session/reconcile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { subscriptionStatus?: string | null } | null;

    if (response.ok && hasUsableSubscription(payload?.subscriptionStatus)) {
      return NextResponse.redirect(new URL("/onboarding/connect-channels", origin));
    }
  } catch {
    // The Checkout page retains its existing authenticated retry path.
  }

  return NextResponse.redirect(fallback);
}
