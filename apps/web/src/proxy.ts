import { NextRequest, NextResponse } from "next/server";
import { createContentSecurityPolicy, SECURITY_RESPONSE_HEADERS } from "@/lib/security/headers";

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    "Content-Security-Policy",
    createContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production"),
  );

  for (const [name, value] of SECURITY_RESPONSE_HEADERS) {
    response.headers.set(name, value);
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)"],
};
