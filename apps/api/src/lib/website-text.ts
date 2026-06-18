export async function fetchWebsiteText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LeadReacher/1.0 (+https://leadreacher.com)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website (${response.status})`);
  }

  const html = await response.text();
  const withoutScripts = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 3000);
}

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
];

export function extractPreviewImageFromHtml(
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
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LeadReacher/1.0 (+https://leadreacher.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractPreviewImageFromHtml(html, response.url || url);
  } catch {
    return null;
  }
}
