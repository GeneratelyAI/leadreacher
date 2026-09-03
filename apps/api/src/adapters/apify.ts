import { ExternalServiceError, externalServiceFailure } from "../lib/errors.js";
import { resolveCompanyHeadcountCodes } from "./linkedin-company-size-codes.js";
import { resolveIndustryIds } from "./linkedin-industry-codes.js";
import type { ProspectProfile, ProspectSearchFilters } from "./prospect-search.js";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const LINKEDIN_SEARCH_ACTOR_ID = "harvestapi~linkedin-profile-search";
const LINKEDIN_COMPANY_SEARCH_ACTOR_ID = "harvestapi~linkedin-company-search";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export type ApifyCredentials = {
  apiKey: string;
};

export type ICPFilters = ProspectSearchFilters;

export type ScrapeLeadsOptions = {
  profileScraperMode?: ActorRunInput["profileScraperMode"];
};

type RawLinkedInProfile = {
  _meta?: RawLinkedInDatasetMeta["_meta"];
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  location?: {
    linkedinText?: string;
    parsed?: { city?: string; country?: string; state?: string };
  };
  currentPosition?: Array<{ companyName?: string; position?: string }>;
  emails?: Array<{
    email?: string;
    deliverable?: boolean;
    status?: string;
    qualityScore?: number;
  }>;
  phone?: string;
  publicIdentifier?: string;
  id?: string;
  profilePictureUrl?: string;
  pictureUrl?: string;
  profilePicture?: string | { url?: string };
  /** Legacy / forward-compat - actor does not return these today */
  industry?: string;
  companySize?: string;
};

type RawLinkedInCompany = {
  _meta?: RawLinkedInDatasetMeta["_meta"];
  id?: string;
  universalName?: string;
  linkedinUrl?: string;
  name?: string;
  tagline?: string;
  website?: string;
  phone?: string | null;
  logo?: string;
  industry?: string;
  industries?: Array<{
    id?: string;
    name?: string;
    title?: string;
    hierarchy?: string;
  }>;
  employeeCount?: number;
  employeeCountRange?: { start?: number | null; end?: number | null };
  followerCount?: number;
  description?: string;
  locations?: Array<{
    parsed?: {
      text?: string;
      city?: string;
      state?: string;
      country?: string;
      countryFull?: string;
    };
    city?: string;
    geographicArea?: string | null;
    country?: string;
    headquarter?: boolean;
  }>;
};

export type ScrapedProfile = ProspectProfile;

export type ScrapedCompany = {
  linkedinUrl: string;
  name: string;
  universalName?: string;
  website?: string;
  tagline?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  employeeCountRange?: { start?: number | null; end?: number | null };
  followerCount?: number;
  location?: string;
  enrichmentData: Record<string, unknown>;
};

export type CompanySearchResult = {
  companies: ScrapedCompany[];
  totalFound: number;
  skipped: boolean;
  reason?: string;
};

type ActorRunInput = {
  maxItems: number;
  takePages?: number;
  profileScraperMode?: "Short" | "Full" | "Full + email search";
  industryIds?: number[];
  companyHeadcount?: string[];
  currentJobTitles?: string[];
  locations?: string[];
  searchQuery?: string;
  proxy: { useApifyProxy: boolean };
};

type CompanyActorRunInput = {
  maxItems: number;
  scraperMode: "full";
  industryIds?: number[];
  companySize?: string[];
  locations?: string[];
  searchQuery?: string;
  proxy: { useApifyProxy: boolean };
};

type RawLinkedInDatasetMeta = {
  _meta?: {
    pagination?: {
      totalElements?: number;
    };
  };
};

type FetchResultsResult<T> = {
  items: T[];
  totalFound: number;
};

function isApifyQuotaMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("free user") ||
    normalized.includes("quota") ||
    normalized.includes("credit") ||
    normalized.includes("usage limit") ||
    normalized.includes("run limit")
  );
}

export type ApifyFailureKind = "quota" | "transient" | "unavailable";

export function classifyApifyFailure(error: unknown): ApifyFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (isApifyQuotaMessage(message)) return "quota";
  if (/\b(?:408|429|5\d\d|timed?\s*out|timeout)\b/i.test(message)) {
    return "transient";
  }
  return "unavailable";
}

function hasCompanySearchCriteria(input: CompanyActorRunInput): boolean {
  return Boolean(
    input.industryIds?.length ||
      input.companySize?.length ||
      input.locations?.length ||
      input.searchQuery?.trim(),
  );
}

export class ApifyAdapter {
  constructor(private readonly credentials: ApifyCredentials) {}

  private buildUrl(path: string): string {
    const url = new URL(`${APIFY_BASE_URL}${path}`);
    url.searchParams.set("token", this.credentials.apiKey);
    return url.toString();
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const maxAttempts = method === "GET" ? 3 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const res = await fetch(this.buildUrl(path), {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body && { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) {
          return (await res.json()) as T;
        }

        const text = await res.text();
        const error = new ExternalServiceError("Apify", `${res.status}: ${text}`);
        if (classifyApifyFailure(error) !== "transient" || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
      } catch (error) {
        if (classifyApifyFailure(error) !== "transient" || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
      }

      const jitterMs = Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1) + jitterMs));
    }

    throw externalServiceFailure("Apify", lastError ?? new Error("Request failed"));
  }

  /**
   * Maps ICPFilters to harvestapi/linkedin-profile-search input schema.
   * Current Apify pricing is about $0.10 per 25-result search page plus $0.01/profile
   * for Full + email search before subscription discounts.
   * Some results can still be anonymized LinkedIn Member profiles with no accessible
   * link/email; that is a LinkedIn-side limitation, so reachability below 100% is expected.
   * Keep maxResults conservative for onboarding/strategy runs; this should never run unbounded.
   */
  private buildActorInput(
    filters: ICPFilters,
    maxResults: number,
    options: ScrapeLeadsOptions = {},
  ): ActorRunInput {
    const industryIds = resolveIndustryIds(filters.industries);
    const companyHeadcount = resolveCompanyHeadcountCodes(filters.companySizes);
    const input: ActorRunInput = {
      maxItems: Math.min(Math.max(maxResults, 1), 100),
      // HarvestAPI requires a positive page count to reliably apply search
      // filters and finish the run. One page contains up to 25 profiles.
      takePages: Math.max(1, Math.ceil(Math.min(Math.max(maxResults, 1), 100) / 25)),
      profileScraperMode: options.profileScraperMode ?? "Full + email search",
      proxy: { useApifyProxy: true },
    };

    if (filters.jobTitles.length > 0) {
      input.currentJobTitles = filters.jobTitles;
    }
    if (filters.locations.length > 0) {
      input.locations = filters.locations;
    }
    if (industryIds.length > 0) {
      input.industryIds = industryIds;
    }
    if (companyHeadcount.length > 0) {
      input.companyHeadcount = companyHeadcount;
    }
    if (filters.keywords && filters.keywords.length > 0) {
      input.searchQuery = filters.keywords.join(" OR ");
    }

    return input;
  }

  /**
   * Company search uses a different HarvestAPI actor built for firmographic counts.
   * Approximate Apify costs can change: profile search is about $0.10 per 25-result
   * search page before enrichment, while full company search is about $3-$4 per
   * 1,000 companies depending on plan. Strategy generation runs once per onboarding,
   * so callers should cap maxResults conservatively.
   */
  private buildCompanyActorInput(
    filters: ICPFilters,
    maxResults: number,
  ): CompanyActorRunInput {
    const industryIds = resolveIndustryIds(filters.industries);
    const companySize = resolveCompanyHeadcountCodes(filters.companySizes);
    const input: CompanyActorRunInput = {
      maxItems: Math.min(Math.max(maxResults, 1), 1000),
      scraperMode: "full",
      proxy: { useApifyProxy: true },
    };

    if (filters.locations.length > 0) {
      input.locations = filters.locations;
    }
    if (industryIds.length > 0) {
      input.industryIds = industryIds;
    }
    if (companySize.length > 0) {
      input.companySize = companySize;
    }
    if (filters.keywords && filters.keywords.length > 0) {
      input.searchQuery = filters.keywords.join(" OR ");
    }

    return input;
  }

  private async startRun(
    actorId: string,
    input: ActorRunInput | CompanyActorRunInput,
  ): Promise<string> {
    const response = await this.request<{ data: { id: string } }>(
      "POST",
      `/acts/${actorId}/runs`,
      input,
    );
    return response.data.id;
  }

  private async waitForRun(actorId: string, runId: string): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
      const response = await this.request<{
        data: {
          status: string;
          statusMessage?: string;
          isStatusMessageTerminal?: boolean;
        };
      }>(
        "GET",
        `/acts/${actorId}/runs/${runId}`,
      );
      const { status, statusMessage, isStatusMessageTerminal } = response.data;
      const isTerminalStatus =
        status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT";
      // Apify attaches informational statusMessages throughout a run (e.g. a
      // free-tier queuing notice) long before the run actually finishes.
      // isStatusMessageTerminal (or the run status itself reaching a terminal
      // state) is what tells us the message is the final word, not a
      // transient one the run may still recover from - without this check we
      // aborted runs that went on to succeed moments later.
      if (
        statusMessage &&
        isApifyQuotaMessage(statusMessage) &&
        (isStatusMessageTerminal || isTerminalStatus)
      ) {
        throw new ExternalServiceError(
          "Apify",
          `Actor run could not execute: ${statusMessage}`,
        );
      }
      if (status === "SUCCEEDED") return;
      if (isTerminalStatus) {
        throw new ExternalServiceError("Apify", `Actor run ${status}: ${runId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    await this.abortRun(runId);
    throw externalServiceFailure("Apify", new Error(`Actor run timed out after ${POLL_TIMEOUT_MS}ms`));
  }

  private async abortRun(runId: string): Promise<void> {
    try {
      await this.request("POST", `/actor-runs/${runId}/abort`);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "apify-abort-failed",
          runId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /** Dataset items live under /actor-runs/{runId}, not under /acts/{actorId}/runs/{runId}. */
  private async fetchResults<T extends RawLinkedInDatasetMeta>(
    runId: string,
  ): Promise<FetchResultsResult<T>> {
    const response = await this.request<T[]>(
      "GET",
      `/actor-runs/${runId}/dataset/items`,
    );
    const items = Array.isArray(response) ? response : [];
    // Intentionally ignore totalResultCount. In a confirmed company-search run it reported
    // 142,857 while the actor log and totalElements both reported 1,000 results. The actor
    // does not document totalResultCount, so totalElements remains the only trusted dataset
    // pagination total until Apify documents the field's meaning.
    const metaTotal = items
      .map((item) => item._meta?.pagination?.totalElements)
      .find((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      items,
      totalFound: metaTotal ?? items.length,
    };
  }

  private normalize(raw: RawLinkedInProfile): ScrapedProfile | null {
    const linkedinUrl = raw.linkedinUrl;

    let firstName = raw.firstName;
    let lastName = raw.lastName;
    if (!firstName && !lastName && raw.fullName) {
      const parts = raw.fullName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }

    if (!linkedinUrl || !firstName || !lastName) return null;

    const location = raw.location?.parsed
      ? [
          raw.location.parsed.city,
          raw.location.parsed.state,
          raw.location.parsed.country,
        ]
          .filter(Boolean)
          .join(", ")
      : raw.location?.linkedinText;

    return {
      linkedinUrl,
      firstName,
      lastName,
      title: raw.currentPosition?.[0]?.position ?? raw.headline ?? "",
      company: raw.currentPosition?.[0]?.companyName ?? "",
      location,
      email: raw.emails?.[0]?.email,
      phone: raw.phone,
      publicIdentifier: raw.publicIdentifier,
      providerLinkedinId: raw.id,
      avatarUrl:
        raw.profilePictureUrl ??
        raw.pictureUrl ??
        (typeof raw.profilePicture === "string" ? raw.profilePicture : raw.profilePicture?.url),
      enrichmentData: raw as Record<string, unknown>,
    };
  }

  private normalizeCompany(raw: RawLinkedInCompany): ScrapedCompany | null {
    if (!raw.linkedinUrl || !raw.name) {
      return null;
    }

    const headquarters =
      raw.locations?.find((location) => location.headquarter) ?? raw.locations?.[0];
    const parsedLocation = headquarters?.parsed;
    const location =
      parsedLocation?.text ??
      [
        parsedLocation?.city ?? headquarters?.city,
        parsedLocation?.state ?? headquarters?.geographicArea,
        parsedLocation?.countryFull ?? parsedLocation?.country ?? headquarters?.country,
      ]
        .filter(Boolean)
        .join(", ");

    return {
      linkedinUrl: raw.linkedinUrl,
      name: raw.name,
      universalName: raw.universalName,
      website: raw.website,
      tagline: raw.tagline,
      description: raw.description,
      // LinkedIn companies can include multiple industries; Strategy currently uses the primary one.
      // If multi-industry breakdowns become valuable, count each company across all returned industries.
      industry: raw.industry ?? raw.industries?.[0]?.name,
      employeeCount: raw.employeeCount,
      employeeCountRange: raw.employeeCountRange,
      followerCount: raw.followerCount,
      location: location || undefined,
      enrichmentData: raw as Record<string, unknown>,
    };
  }

  async scrapeLeads(filters: ICPFilters, maxResults = 100): Promise<ScrapedProfile[]> {
    const { profiles } = await this.scrapeLeadsWithTotal(filters, maxResults);
    return profiles;
  }

  async scrapeLeadsWithTotal(
    filters: ICPFilters,
    maxResults = 100,
    options: ScrapeLeadsOptions = {},
  ): Promise<{ profiles: ScrapedProfile[]; totalFound: number }> {
    const input = this.buildActorInput(filters, maxResults, options);
    const runId = await this.startRun(LINKEDIN_SEARCH_ACTOR_ID, input);
    await this.waitForRun(LINKEDIN_SEARCH_ACTOR_ID, runId);
    const { items, totalFound } = await this.fetchResults<RawLinkedInProfile>(runId);
    const profiles = items.flatMap((item) => {
      const normalized = this.normalize(item);
      return normalized ? [normalized] : [];
    });

    return { profiles, totalFound };
  }

  async searchCompanies(
    filters: ICPFilters,
    maxResults = 100,
  ): Promise<CompanySearchResult> {
    const input = this.buildCompanyActorInput(filters, maxResults);
    if (!hasCompanySearchCriteria(input)) {
      return {
        companies: [],
        totalFound: 0,
        skipped: true,
        reason:
          "Company search requires an industry, company size, location, or market query.",
      };
    }

    const runId = await this.startRun(LINKEDIN_COMPANY_SEARCH_ACTOR_ID, input);
    await this.waitForRun(LINKEDIN_COMPANY_SEARCH_ACTOR_ID, runId);
    const { items, totalFound } = await this.fetchResults<RawLinkedInCompany>(runId);
    const companies = items.flatMap((item) => {
      const normalized = this.normalizeCompany(item);
      return normalized ? [normalized] : [];
    });

    return { companies, totalFound, skipped: false };
  }
}
