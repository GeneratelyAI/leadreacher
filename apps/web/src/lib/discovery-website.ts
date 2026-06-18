const WEBSITE_URL_REGEX = /https?:\/\/[^\s]+/i;
const DOMAIN_ONLY_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;

export type WebsiteLinkInfo = {
  href: string;
  label: string;
  hostname: string;
};

export function containsWebsiteUrl(text: string): boolean {
  const trimmed = text.trim();
  return WEBSITE_URL_REGEX.test(trimmed) || DOMAIN_ONLY_REGEX.test(trimmed);
}

export function getWebsiteFaviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
}

export function parseWebsiteLink(content: string): WebsiteLinkInfo | null {
  const trimmed = content.trim();
  const httpMatch = trimmed.match(WEBSITE_URL_REGEX);
  const candidate = httpMatch?.[0]
    ?? (DOMAIN_ONLY_REGEX.test(trimmed) ? `https://${trimmed}` : null);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.replace(/^www\./i, "");
    const label = httpMatch
      ? trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "")
      : trimmed;

    return {
      href: url.toString(),
      label,
      hostname,
    };
  } catch {
    return null;
  }
}
