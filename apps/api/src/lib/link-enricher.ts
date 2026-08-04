import { env } from "../config/env.js";
import { normalizeWebsiteUrl, scrapeWebsiteMarkdown } from "./firecrawl.js";
import { resolvePublicUrl } from "./public-url.js";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60_000;
const MAX_MARKDOWN_CHARS = 3000;

const ACTORS = {
  instagram: "apify~instagram-profile-scraper",
  facebook: "apify~facebook-pages-scraper",
  linkedinCompany: "voyager~linkedin-company-scraper",
  tiktok: "clockworks~tiktok-profile-scraper",
  twitter: "apidojo~tweet-scraper",
} as const;

const enrichmentCache = new Map<string, string>();

type LinkKind =
  | "instagram"
  | "facebook"
  | "linkedin-company"
  | "tiktok"
  | "twitter"
  | "website";

function sliceMarkdown(text: string): string {
  return text.trim().slice(0, MAX_MARKDOWN_CHARS);
}

function buildApifyUrl(path: string): string {
  const url = new URL(`${APIFY_BASE_URL}${path}`);
  url.searchParams.set("token", env.APIFY_API_KEY);
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function formatCount(label: string, value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `**${label}:** ${value.toLocaleString("en-US")}`;
}

function formatSections(sections: Array<string | null | undefined>): string {
  return sliceMarkdown(
    sections.filter((section): section is string => Boolean(section?.trim())).join("\n"),
  );
}

function classifyUrl(url: string): LinkKind {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host.includes("instagram.com")) {
    return "instagram";
  }
  if (host.includes("facebook.com") || host === "fb.com" || host === "m.facebook.com") {
    return "facebook";
  }
  if (host.includes("linkedin.com") && path.includes("/company")) {
    return "linkedin-company";
  }
  if (host.includes("tiktok.com")) {
    return "tiktok";
  }
  if (host === "twitter.com" || host === "x.com") {
    return "twitter";
  }
  return "website";
}

function extractInstagramUsername(url: string): string | null {
  const path = new URL(url).pathname;
  const match = path.match(/^\/([^/?]+)/);
  const username = match?.[1]?.trim();
  if (!username) {
    return null;
  }

  const reserved = new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);
  if (reserved.has(username.toLowerCase())) {
    return null;
  }

  return username.replace(/^@/, "");
}

function extractTikTokUsername(url: string): string | null {
  const match = url.match(/tiktok\.com\/@([^/?]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractTwitterUsername(url: string): string | null {
  const path = new URL(url).pathname;
  const match = path.match(/^\/([^/?]+)/);
  const username = match?.[1]?.trim();
  if (!username) {
    return null;
  }

  const reserved = new Set([
    "home",
    "search",
    "explore",
    "i",
    "intent",
    "share",
    "hashtag",
  ]);
  if (reserved.has(username.toLowerCase())) {
    return null;
  }

  return username.replace(/^@/, "");
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<unknown[]> {
  const startResponse = await fetch(buildApifyUrl(`/acts/${actorId}/runs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!startResponse.ok) {
    const body = await startResponse.text().catch(() => "");
    throw new Error(
      `Apify actor start failed (${startResponse.status})${body ? `: ${body}` : ""}`,
    );
  }

  const started = (await startResponse.json()) as { data?: { id?: string } };
  const runId = started.data?.id;
  if (!runId) {
    throw new Error("Apify actor run id missing");
  }

  const pollStart = Date.now();
  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    const statusResponse = await fetch(buildApifyUrl(`/actor-runs/${runId}`));
    if (!statusResponse.ok) {
      const body = await statusResponse.text().catch(() => "");
      throw new Error(
        `Apify run status failed (${statusResponse.status})${body ? `: ${body}` : ""}`,
      );
    }

    const statusPayload = (await statusResponse.json()) as {
      data?: { status?: string };
    };
    const status = statusPayload.data?.status;
    if (status === "SUCCEEDED") {
      break;
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify actor run ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (Date.now() - pollStart >= POLL_TIMEOUT_MS) {
    throw new Error(`Apify actor run timed out after ${POLL_TIMEOUT_MS}ms`);
  }

  const itemsResponse = await fetch(
    buildApifyUrl(`/actor-runs/${runId}/dataset/items`),
  );
  if (!itemsResponse.ok) {
    const body = await itemsResponse.text().catch(() => "");
    throw new Error(
      `Apify dataset fetch failed (${itemsResponse.status})${body ? `: ${body}` : ""}`,
    );
  }

  const items = (await itemsResponse.json()) as unknown;
  return Array.isArray(items) ? items : [];
}

function extractPostCaptions(items: unknown[], keys: string[], limit = 5): string[] {
  const captions: string[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        captions.push(value.trim());
        break;
      }
    }

    if (captions.length >= limit) {
      break;
    }
  }

  return captions;
}

async function scrapeInstagramProfile(url: string): Promise<string> {
  const username = extractInstagramUsername(url);
  if (!username) {
    return "";
  }

  const items = await runApifyActor(ACTORS.instagram, {
    usernames: [username],
  });
  const profile = asRecord(items[0]);
  if (!profile) {
    return "";
  }

  const latestPosts = Array.isArray(profile.latestPosts)
    ? profile.latestPosts
    : Array.isArray(profile.posts)
      ? profile.posts
      : [];
  const captions = extractPostCaptions(latestPosts, ["caption", "text", "description"]);

  return formatSections([
    `# Instagram @${pickString(profile, ["username", "userName"]) || username}`,
    pickString(profile, ["fullName", "name"])
      ? `**Name:** ${pickString(profile, ["fullName", "name"])}`
      : null,
    pickString(profile, ["biography", "bio", "description"])
      ? `**Bio:** ${pickString(profile, ["biography", "bio", "description"])}`
      : null,
    formatCount("Followers", pickNumber(profile, ["followersCount", "followers", "followerCount"])),
    formatCount("Following", pickNumber(profile, ["followsCount", "followingCount"])),
    formatCount("Posts", pickNumber(profile, ["postsCount", "mediaCount"])),
    captions.length > 0
      ? `**Recent post captions:**\n${captions.map((caption) => `- ${caption}`).join("\n")}`
      : null,
  ]);
}

async function scrapeFacebookPage(url: string): Promise<string> {
  const items = await runApifyActor(ACTORS.facebook, {
    startUrls: [{ url }],
  });
  const page = asRecord(items[0]);
  if (!page) {
    return "";
  }

  const categories = Array.isArray(page.categories)
    ? page.categories
        .map((category) => (typeof category === "string" ? category.trim() : ""))
        .filter(Boolean)
    : [];

  return formatSections([
    `# Facebook Page`,
    pickString(page, ["title", "name", "pageName"])
      ? `**Name:** ${pickString(page, ["title", "name", "pageName"])}`
      : null,
    pickString(page, ["category", "pageCategory"]) || categories.length > 0
      ? `**Category:** ${pickString(page, ["category", "pageCategory"]) || categories.join(", ")}`
      : null,
    pickString(page, ["about", "description", "info", "intro"])
      ? `**About:** ${pickString(page, ["about", "description", "info", "intro"])}`
      : null,
    formatCount("Likes", pickNumber(page, ["likes", "likeCount", "likesCount"])),
    formatCount(
      "Followers",
      pickNumber(page, ["followers", "followerCount", "followersCount"]),
    ),
    pickString(page, ["website"]) ? `**Website:** ${pickString(page, ["website"])}` : null,
  ]);
}

async function scrapeLinkedInCompany(url: string): Promise<string> {
  const items = await runApifyActor(ACTORS.linkedinCompany, {
    startUrls: [{ url }],
  });
  const company = asRecord(items[0]);
  if (!company) {
    return "";
  }

  const specialties = Array.isArray(company.specialties)
    ? company.specialties
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const keywords = pickString(company, ["keywords", "tags"]);

  return formatSections([
    `# LinkedIn Company`,
    pickString(company, ["name", "companyName", "title"])
      ? `**Name:** ${pickString(company, ["name", "companyName", "title"])}`
      : null,
    pickString(company, ["industry", "industries"])
      ? `**Industry:** ${pickString(company, ["industry", "industries"])}`
      : null,
    pickString(company, ["description", "about", "tagline"])
      ? `**Description:** ${pickString(company, ["description", "about", "tagline"])}`
      : null,
    formatCount(
      "Followers",
      pickNumber(company, ["followerCount", "followers", "followersCount"]),
    ),
    specialties.length > 0 ? `**Specialties:** ${specialties.join(", ")}` : null,
    keywords ? `**Keywords:** ${keywords}` : null,
    pickString(company, ["website"]) ? `**Website:** ${pickString(company, ["website"])}` : null,
  ]);
}

async function scrapeTikTokProfile(url: string): Promise<string> {
  const username = extractTikTokUsername(url);
  if (!username) {
    return "";
  }

  const items = await runApifyActor(ACTORS.tiktok, {
    profiles: [username],
  });
  const profile = asRecord(items[0]);
  if (!profile) {
    return "";
  }

  const recentVideos = Array.isArray(profile.latestVideos)
    ? profile.latestVideos
    : Array.isArray(profile.videos)
      ? profile.videos
      : items.slice(0, 5);
  const captions = extractPostCaptions(recentVideos, [
    "text",
    "desc",
    "description",
    "caption",
  ]);

  return formatSections([
    `# TikTok @${pickString(profile, ["uniqueId", "username", "name"]) || username}`,
    pickString(profile, ["nickName", "nickname", "displayName"])
      ? `**Name:** ${pickString(profile, ["nickName", "nickname", "displayName"])}`
      : null,
    pickString(profile, ["signature", "bio", "description"])
      ? `**Bio:** ${pickString(profile, ["signature", "bio", "description"])}`
      : null,
    formatCount("Followers", pickNumber(profile, ["followerCount", "fans", "followers"])),
    formatCount("Likes", pickNumber(profile, ["heartCount", "likes", "diggCount"])),
    formatCount("Videos", pickNumber(profile, ["videoCount", "videos"])),
    captions.length > 0
      ? `**Recent video captions:**\n${captions.map((caption) => `- ${caption}`).join("\n")}`
      : null,
  ]);
}

async function scrapeTwitterProfile(url: string): Promise<string> {
  const items = await runApifyActor(ACTORS.twitter, {
    startUrls: [url],
    maxItems: 10,
  });

  if (items.length === 0) {
    return "";
  }

  const first = asRecord(items[0]);
  const author = asRecord(first?.author) ?? asRecord(first?.user) ?? first;
  const username =
    extractTwitterUsername(url) ||
    pickString(author ?? {}, ["userName", "username", "screen_name", "name"]);

  const bio = pickString(author ?? {}, [
    "description",
    "bio",
    "profile_bio",
    "profileDescription",
  ]);
  const followers = pickNumber(author ?? {}, [
    "followers",
    "followersCount",
    "followers_count",
  ]);
  const tweets = extractPostCaptions(items, [
    "text",
    "fullText",
    "full_text",
    "tweetText",
    "content",
  ]);

  return formatSections([
    username ? `# X @${username.replace(/^@/, "")}` : "# X Profile",
    bio ? `**Bio:** ${bio}` : null,
    formatCount("Followers", followers),
    tweets.length > 0
      ? `**Recent posts:**\n${tweets.map((tweet) => `- ${tweet}`).join("\n")}`
      : null,
  ]);
}

async function enrichUrlByKind(url: string, kind: LinkKind): Promise<string> {
  switch (kind) {
    case "instagram":
      return scrapeInstagramProfile(url);
    case "facebook":
      return scrapeFacebookPage(url);
    case "linkedin-company":
      return scrapeLinkedInCompany(url);
    case "tiktok":
      return scrapeTikTokProfile(url);
    case "twitter":
      return scrapeTwitterProfile(url);
    case "website":
      return scrapeWebsiteMarkdown(url);
  }
}

export async function enrichFromUrl(url: string): Promise<string> {
  const normalized = normalizeWebsiteUrl(url);
  await resolvePublicUrl(normalized);

  const cached = enrichmentCache.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  let markdown = "";
  const kind = classifyUrl(normalized);

  try {
    markdown = await enrichUrlByKind(normalized, kind);
  } catch (error) {
    console.error("[link-enricher] enrichment failed", {
      url: normalized,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
    markdown = "";
  }

  // Empty enrichment after a runtime failure is not a stable answer. Keeping
  // it uncached lets a later request retry the provider.
  if (markdown) {
    enrichmentCache.set(normalized, markdown);
  }
  return markdown;
}
