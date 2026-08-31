function configuredApiOrigin(apiUrl = process.env.NEXT_PUBLIC_API_URL): string {
  try {
    return apiUrl ? new URL(apiUrl).origin : "https://api.leadreacher.ai";
  } catch {
    return "https://api.leadreacher.ai";
  }
}

export function createContentSecurityPolicy(
  nonce: string,
  isDevelopment: boolean,
  apiUrl = process.env.NEXT_PUBLIC_API_URL,
): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "https://challenges.cloudflare.com", "https://js.stripe.com"];
  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    configuredApiOrigin(apiUrl),
    "https://*.unipile.com",
    "https://*.ingest.sentry.io",
    "https://challenges.cloudflare.com",
    "https://api.stripe.com",
    "https://checkout.stripe.com",
  ];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http://localhost:*", "ws://localhost:*");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "worker-src 'self' blob:",
  ].join("; ");
}

export const SECURITY_RESPONSE_HEADERS: Array<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
];
