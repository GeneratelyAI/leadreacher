export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "https://challenges.cloudflare.com"];
  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "https://api.leadreacher.ai",
    "https://*.unipile.com",
    "https://*.ingest.sentry.io",
    "https://challenges.cloudflare.com",
  ];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http://localhost:*", "ws://localhost:*");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
  ].join("; ");
}

export const SECURITY_RESPONSE_HEADERS: Array<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
];
