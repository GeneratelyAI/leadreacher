import { ExternalServiceError } from "../lib/errors.js";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const LINKEDIN_SEARCH_ACTOR_ID = "harvestapi~linkedin-profile-search";
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
  emails?: string[];
  phone?: string;
  publicIdentifier?: string;
  id?: string;
  /** Legacy / forward-compat — actor does not return these today */
  industry?: string;
  companySize?: string;
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

type ActorRunInput = {
  maxItems: number;
  currentJobTitles?: string[];
  locations?: string[];
  searchQuery?: string;
  proxy: { useApifyProxy: boolean };
};

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
    const res = await fetch(this.buildUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ExternalServiceError("Apify", text);
    }
    return (await res.json()) as T;
  }

  /**
   * Maps ICPFilters to harvestapi/linkedin-profile-search input schema.
   * industries: actor expects industryIds (LinkedIn numeric codes), not names — intentionally unused.
   * companySizes: actor expects companyHeadcount codes (A–I), not free-form strings — intentionally unused.
   */
  private buildActorInput(filters: ICPFilters, maxResults: number): ActorRunInput {
    const input: ActorRunInput = {
      maxItems: maxResults,
      proxy: { useApifyProxy: true },
    };

    if (filters.jobTitles.length > 0) {
      input.currentJobTitles = filters.jobTitles;
    }
    if (filters.locations.length > 0) {
      input.locations = filters.locations;
    }
    if (filters.keywords && filters.keywords.length > 0) {
      input.searchQuery = filters.keywords.join(" OR ");
    }

    return input;
  }

  private async startRun(input: ActorRunInput): Promise<string> {
    const response = await this.request<{ data: { id: string } }>(
      "POST",
      `/acts/${LINKEDIN_SEARCH_ACTOR_ID}/runs`,
      input,
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

  /** Dataset items live under /actor-runs/{runId}, not under /acts/{actorId}/runs/{runId}. */
  private async fetchResults(runId: string): Promise<RawLinkedInProfile[]> {
    const response = await this.request<RawLinkedInProfile[]>(
      "GET",
      `/actor-runs/${runId}/dataset/items`,
    );
    return Array.isArray(response) ? response : [];
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
      title: raw.headline ?? raw.currentPosition?.[0]?.position ?? "",
      company: raw.currentPosition?.[0]?.companyName ?? "",
      location,
      email: raw.emails?.[0],
      phone: raw.phone,
      publicIdentifier: raw.publicIdentifier,
      providerLinkedinId: raw.id,
      enrichmentData: raw as Record<string, unknown>,
    };
  }

  async scrapeLeads(filters: ICPFilters, maxResults = 100): Promise<ScrapedProfile[]> {
    const input = this.buildActorInput(filters, maxResults);
    const runId = await this.startRun(input);
    await this.waitForRun(runId);
    const raw = await this.fetchResults(runId);
    return raw.flatMap((item) => {
      const normalized = this.normalize(item);
      return normalized ? [normalized] : [];
    });
  }
}
