import { ExternalServiceError } from "../lib/errors.js";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const LINKEDIN_SEARCH_ACTOR_ID = "harvestapi/linkedin-profile-search";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

export type ApifyCredentials = {
  apiKey: string;
};

export type ICPFilters = {
  jobTitles: string[];
  industries: string[];
  companySizes: string[];
  locations: string[];
  keywords?: string[];
};

type RawLinkedInProfile = {
  profileUrl?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  location?: string;
  company?: string;
  companySize?: string;
  industry?: string;
  email?: string;
  phone?: string;
  publicIdentifier?: string;
  providerId?: string;
};

export type ScrapedProfile = {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  location?: string;
  industry?: string;
  companySize?: string;
  email?: string;
  phone?: string;
  publicIdentifier?: string;
  providerLinkedinId?: string;
  enrichmentData: Record<string, unknown>;
};

export class ApifyAdapter {
  constructor(private readonly credentials: ApifyCredentials) {}

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.credentials.apiKey}`,
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${APIFY_BASE_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      ...(body && { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ExternalServiceError("Apify", text);
    }
    return (await res.json()) as T;
  }

  buildSearchUrl(filters: ICPFilters): string {
    const params = new URLSearchParams();
    if (filters.jobTitles.length > 0) {
      params.set("keywords", filters.jobTitles.join(" OR "));
    }
    if (filters.locations.length > 0) {
      params.set("location", filters.locations.join(","));
    }
    const base = "https://www.linkedin.com/search/results/people/";
    return `${base}?${params.toString()}`;
  }

  private async startRun(searchUrl: string, maxResults: number): Promise<string> {
    const response = await this.request<{ data: { id: string } }>(
      "POST",
      `/acts/${LINKEDIN_SEARCH_ACTOR_ID}/runs`,
      { searchUrl, maxResults, proxy: { useApifyProxy: true } },
    );
    return response.data.id;
  }

  private async waitForRun(runId: string): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
      const response = await this.request<{ data: { status: string } }>(
        "GET",
        `/acts/${LINKEDIN_SEARCH_ACTOR_ID}/runs/${runId}`,
      );
      const { status } = response.data;
      if (status === "SUCCEEDED") return;
      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        throw new ExternalServiceError("Apify", `Actor run ${status}: ${runId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new ExternalServiceError("Apify", `Actor run timed out after ${POLL_TIMEOUT_MS}ms`);
  }

  private async fetchResults(runId: string): Promise<RawLinkedInProfile[]> {
    const response = await this.request<{ items: RawLinkedInProfile[] }>(
      "GET",
      `/acts/${LINKEDIN_SEARCH_ACTOR_ID}/runs/${runId}/dataset/items`,
    );
    return response.items ?? [];
  }

  private normalize(raw: RawLinkedInProfile): ScrapedProfile | null {
    const linkedinUrl = raw.profileUrl;
    const firstName = raw.firstName ?? raw.fullName?.split(" ")[0];
    const lastName = raw.lastName ?? raw.fullName?.split(" ").slice(1).join(" ");
    if (!linkedinUrl || !firstName || !lastName) return null;
    return {
      linkedinUrl,
      firstName,
      lastName,
      title: raw.headline ?? "",
      company: raw.company ?? "",
      location: raw.location,
      industry: raw.industry,
      companySize: raw.companySize,
      email: raw.email,
      phone: raw.phone,
      publicIdentifier: raw.publicIdentifier,
      providerLinkedinId: raw.providerId,
      enrichmentData: raw as Record<string, unknown>,
    };
  }

  async scrapeLeads(filters: ICPFilters, maxResults = 100): Promise<ScrapedProfile[]> {
    const searchUrl = this.buildSearchUrl(filters);
    const runId = await this.startRun(searchUrl, maxResults);
    await this.waitForRun(runId);
    const raw = await this.fetchResults(runId);
    return raw.flatMap((item) => {
      const normalized = this.normalize(item);
      return normalized ? [normalized] : [];
    });
  }
}
