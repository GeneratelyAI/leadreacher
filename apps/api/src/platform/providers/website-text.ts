import { fetchPublicText } from "./public-url.js";

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
];

function extractPreviewImageFromHtml(
  html: string,
  baseUrl: string,
): string | null {
  for (const pattern of OG_IMAGE_PATTERNS) {
    const match = html.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      continue;
    }

    try {
      return new URL(candidate, baseUrl).toString();
    } catch {
      continue;
    }
  }

  return null;
}

export async function fetchWebsitePreviewImage(
  url: string,
): Promise<string | null> {
  try {
    const response = await fetchPublicText(url, {
      maxBytes: 1_000_000,
      timeoutMs: 8_000,
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
    });

    if (response.status < 200 || response.status >= 300) {
      return null;
    }

    return extractPreviewImageFromHtml(response.body, response.url || url);
  } catch {
    return null;
  }
}
