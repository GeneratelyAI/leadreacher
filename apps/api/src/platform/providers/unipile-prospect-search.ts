import type {
  ProspectProfile,
  ProspectSearchInput,
  ProspectSearchProvider,
  ProspectSearchResult,
} from "./prospect-search.js";
import {
  UnipileAdapter,
  type UnipilePeopleSearchBody,
  type UnipilePeopleSearchResponse,
  type UnipilePeopleSearchResult,
  type UnipileRelationResult,
} from "./unipile.js";

const LINKEDIN_HEADLINE_SEPARATOR = /\s+(?:at|@)\s+/i;
const DEFAULT_NETWORK_DISTANCES = [1, 2, 3];
const RELATION_FALLBACK_SCAN_LIMIT = 500;

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "LinkedIn",
    lastName: parts.slice(1).join(" ") || "Member",
  };
}

function splitHeadline(headline: string | undefined): { title: string; company: string } {
  if (!headline) return { title: "", company: "" };
  const [title, ...companyParts] = headline.split(LINKEDIN_HEADLINE_SEPARATOR);
  return {
    title: title?.trim() ?? "",
    company: companyParts.join(" at ").trim(),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isUsableLinkedInProfileUrl(value: string | undefined): value is string {
  if (!value?.startsWith("https://www.linkedin.com/in/")) return false;
  const identifier = value.slice("https://www.linkedin.com/in/".length).split(/[/?#]/, 1)[0]?.trim();
  return Boolean(identifier) && !["undefined", "null"].includes(identifier.toLowerCase());
}

function profileUrl(result: UnipilePeopleSearchResult): string | null {
  const providerUrl = optionalString(result.profile_url);
  if (isUsableLinkedInProfileUrl(providerUrl)) return providerUrl;

  const publicIdentifier = optionalString(result.public_identifier);
  if (publicIdentifier && !["undefined", "null"].includes(publicIdentifier.toLowerCase())) {
    return `https://www.linkedin.com/in/${publicIdentifier}`;
  }
  return null;
}

export function normalizeUnipileProspect(
  result: UnipilePeopleSearchResult,
): ProspectProfile | null {
  const linkedinUrl = profileUrl(result);
  if (!linkedinUrl || !result.display_name.trim()) return null;

  const name = splitDisplayName(result.display_name);
  const headline = splitHeadline(result.headline);
  return {
    linkedinUrl,
    ...name,
    ...headline,
    location: optionalString(result.location),
    industry: optionalString(result.industry),
    publicIdentifier: optionalString(result.public_identifier),
    providerLinkedinId: result.id,
    avatarUrl: optionalString(result.public_picture_url_large) ?? optionalString(result.public_picture_url),
    enrichmentData: {
      provider: "unipile",
      product: result.product,
      networkDistance: result.network_distance,
      headline: result.headline,
    },
  };
}

function relationDisplayName(relation: UnipileRelationResult): string {
  if (relation.display_name) return relation.display_name;
  return [relation.first_name, relation.last_name].filter(Boolean).join(" ");
}

function normalizeRelationResult(
  relation: UnipileRelationResult,
): UnipilePeopleSearchResult {
  return {
    id: relation.id ?? relation.member_id ?? relation.public_identifier ?? "",
    display_name: relationDisplayName(relation),
    public_identifier: relation.public_identifier,
    profile_url: relation.profile_url ?? relation.public_profile_url,
    public_picture_url: relation.public_picture_url ?? relation.profile_picture_url,
    headline: relation.headline ?? relation.description,
    network_distance: "FIRST_DEGREE",
    product: "classic",
  };
}

function relationMatchesSearch(
  relation: UnipileRelationResult,
  input: ProspectSearchInput,
): boolean {
  const terms = input.filters.jobTitles.length > 0
    ? input.filters.jobTitles
    : input.filters.keywords ?? [];
  if (terms.length === 0) return true;

  const searchable = [
    relationDisplayName(relation),
    relation.headline,
    relation.description,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return terms.some((term) => searchable.includes(term.trim().toLowerCase()));
}

function buildSearchBody(input: ProspectSearchInput): UnipilePeopleSearchBody {
  const keywords = [
    ...input.filters.jobTitles,
    ...(input.filters.keywords ?? []),
  ].filter((value) => value.trim().length > 0);

  return {
    ...(keywords.length > 0 && { keywords: keywords.join(" OR ") }),
    network_distance: DEFAULT_NETWORK_DISTANCES,
  };
}

export class UnipileProspectSearchProvider implements ProspectSearchProvider {
  constructor(
    private readonly adapter: UnipileAdapter,
    private readonly accountId: string,
  ) {}

  private async runSearch(input: ProspectSearchInput): Promise<UnipilePeopleSearchResponse> {
    const body = buildSearchBody(input);
    if (input.searchUrl) {
      return this.adapter.searchLinkedInPeopleFromUrl(
        this.accountId,
        input.searchUrl,
        input.maxResults,
      );
    }

    const response = await this.adapter.searchLinkedInPeople(
      this.accountId,
      body,
      input.maxResults,
    );
    return response.data.length > 0
      ? response
      : this.searchConnectedRelations(input);
  }

  private async searchConnectedRelations(
    input: ProspectSearchInput,
  ): Promise<UnipilePeopleSearchResponse> {
    const relations = await this.adapter.listLinkedInRelations(
      this.accountId,
      RELATION_FALLBACK_SCAN_LIMIT,
    );
    const matches = relations.filter((relation) => relationMatchesSearch(relation, input));
    return {
      data: matches.map(normalizeRelationResult),
      total_count: matches.length,
    };
  }

  async searchPeople(input: ProspectSearchInput): Promise<ProspectSearchResult> {
    const response = await this.runSearch(input);
    const profiles = response.data
      .map(normalizeUnipileProspect)
      .filter((profile): profile is ProspectProfile => profile !== null)
      .slice(0, input.maxResults);

    return {
      profiles,
      totalFound: response.total_count ?? profiles.length,
    };
  }
}
