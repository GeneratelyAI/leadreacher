import { env } from "../config/env.js";
import { fetchWebsitePreviewImage } from "./website-text.js";

const SCRAPE_TIMEOUT_MS = 8_000;
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
    console.error("[discovery] Firecrawl scrape failed", {
      url: normalized,
      error: error instanceof Error ? error.message : String(error),
    });

    const previewImageUrl = await fetchWebsitePreviewImage(normalized);
    // Network, timeout, and 429 failures are retryable. Do not turn them into
    // a process-lifetime empty cache entry.
    return { markdown: "", previewImageUrl };
  }
}

export async function scrapeWebsiteMarkdown(url: string): Promise<string> {
  const result = await scrapeWebsiteContent(url);
  return result.markdown;
}
