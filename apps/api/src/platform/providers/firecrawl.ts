import { env } from "../config/env.js";
import { resolvePublicUrl } from "./public-url.js";
import { fetchWebsitePreviewImage } from "./website-text.js";

const SCRAPE_TIMEOUT_MS = 8_000;
const SCRAPE_MAX_ATTEMPTS = 2;
const scrapedContentByUrl = new Map<
  string,
  { markdown: string; previewImageUrl: string | null }
>();

const WEBSITE_URL_REGEX = /https?:\/\/[^\s]+/i;
const DOMAIN_ONLY_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;

export type WebsiteScrapeResult = {
  markdown: string;
  previewImageUrl: string | null;
};

export function normalizeWebsiteUrl(url: string): string {
  return url.replace(/[),.!?\]]+$/, "").trim();
}

export function extractWebsiteUrlFromText(text: string): string | null {
  const trimmed = text.trim();
  const httpMatch = trimmed.match(WEBSITE_URL_REGEX);
  if (httpMatch) {
    return normalizeWebsiteUrl(httpMatch[0]);
  }

  if (DOMAIN_ONLY_REGEX.test(trimmed)) {
    return normalizeWebsiteUrl(`https://${trimmed}`);
  }

  return null;
}

export async function scrapeWebsiteContent(
  url: string,
): Promise<WebsiteScrapeResult> {
  const normalized = normalizeWebsiteUrl(url);
  await resolvePublicUrl(normalized);

  const cached = scrapedContentByUrl.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  const emptyResult: WebsiteScrapeResult = {
    markdown: "",
    previewImageUrl: null,
  };

  if (!env.FIRECRAWL_API_KEY) {
    const previewImageUrl = await fetchWebsitePreviewImage(normalized);
    const result = { markdown: "", previewImageUrl };
    scrapedContentByUrl.set(normalized, result);
    return result;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= SCRAPE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalized,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Firecrawl scrape failed (${response.status})${body ? `: ${body}` : ""}`,
        );
      }

      const payload = (await response.json()) as {
        data?: {
          markdown?: string;
          metadata?: {
            ogImage?: string;
          };
        };
      };
      const markdown = payload.data?.markdown?.slice(0, 3000) ?? "";
      if (!markdown.trim()) {
        throw new Error("Firecrawl returned empty website content");
      }

      let previewImageUrl =
        typeof payload.data?.metadata?.ogImage === "string" &&
        payload.data.metadata.ogImage.trim()
          ? payload.data.metadata.ogImage.trim()
          : null;

      if (!previewImageUrl) {
        previewImageUrl = await fetchWebsitePreviewImage(normalized);
      }

      const result = { markdown, previewImageUrl };
      scrapedContentByUrl.set(normalized, result);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < SCRAPE_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  console.error("[discovery] Firecrawl scrape failed", {
    url: normalized,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  const previewImageUrl = await fetchWebsitePreviewImage(normalized);
  // Do not turn transient provider failures into a process-lifetime empty
  // cache entry; a later user retry should be able to recover.
  return { markdown: "", previewImageUrl };
}

export async function scrapeWebsiteMarkdown(url: string): Promise<string> {
  const result = await scrapeWebsiteContent(url);
  return result.markdown;
}
