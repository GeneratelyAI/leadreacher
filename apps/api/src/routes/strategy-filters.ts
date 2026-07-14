import type { ICPFilters } from "../adapters/apify.js";

export const COMPANY_SEARCH_UNAVAILABLE_REASON =
  "Industry classification wasn't precise enough for company search - showing decision-maker data only.";

export const COMPANY_SEARCH_NO_RESULTS_REASON =
  "We searched for matching companies but didn't find any real results for this market. Decision-maker data is still available.";

export type CompanySearchPlan = {
  filters: ICPFilters;
  canSearch: boolean;
  reason?: string;
};

const LOCATION_ALIASES: ReadonlyArray<{
  location: string;
  patterns: readonly RegExp[];
}> = [
  {
    location: "United States",
    patterns: [
      /\bunited states\b/i,
      /\bu\.s\.a?\.?\b/i,
      /\busa\b/i,
      /\bus(?:-|\s)(?:based|market|companies|businesses|customers|enterprises)\b/i,
    ],
  },
  {
    location: "United Kingdom",
    patterns: [
      /\bunited kingdom\b/i,
      /\bu\.k\.\b/i,
      /\buk\b/i,
      /\buk(?:-|\s)(?:based|market|companies|businesses|customers|enterprises)\b/i,
      /\bbritish (?:market|companies|businesses|customers|enterprises)\b/i,
    ],
  },
  {
    location: "North America",
    patterns: [/\bnorth america(?:n)?\b/i],
  },
  {
    location: "Europe",
    patterns: [/\beurope(?:an)?\b/i],
  },
  {
    location: "Asia-Pacific",
    patterns: [/\b(?:asia[-\s]?pacific|apac)\b/i],
  },
  {
    location: "Latin America",
    patterns: [/\b(?:latin america|latam)\b/i],
  },
  {
    location: "Middle East",
    patterns: [/\b(?:middle east(?: and africa)?|mea)\b/i],
  },
  { location: "Canada", patterns: [/\bcanada\b/i] },
  { location: "Australia", patterns: [/\baustralia\b/i] },
  { location: "Germany", patterns: [/\bgermany\b/i] },
  { location: "France", patterns: [/\bfrance\b/i] },
  { location: "Netherlands", patterns: [/\bnetherlands\b/i] },
  { location: "India", patterns: [/\bindia\b/i] },
  { location: "Japan", patterns: [/\bjapan\b/i] },
  { location: "Brazil", patterns: [/\bbrazil\b/i] },
  { location: "Mexico", patterns: [/\bmexico\b/i] },
  { location: "Singapore", patterns: [/\bsingapore\b/i] },
  { location: "San Francisco", patterns: [/\bsan francisco\b/i] },
  { location: "New York", patterns: [/\bnew york\b/i] },
  { location: "London", patterns: [/\blondon\b/i] },
  { location: "Toronto", patterns: [/\btoronto\b/i] },
  { location: "Berlin", patterns: [/\bberlin\b/i] },
  { location: "Paris", patterns: [/\bparis\b/i] },
  { location: "Sydney", patterns: [/\bsydney\b/i] },
];

export function parseCompanySizesFromText(text: string): string[] {
  const sizes = new Set<string>();
  const lower = text.toLowerCase();
  const rangeMatches = text.match(
    /\b\d{1,3}(?:,\d{3})?\s*(?:-|\bto\b)\s*\d{1,3}(?:,\d{3})?\s*(?:employees?|people|staff)?/gi,
  );
  rangeMatches?.forEach((match) => sizes.add(match));
  const plusMatches = text.match(
    /\b\d{1,3}(?:,\d{3})*\+\s*(?:employees?|people|staff)?\b/gi,
  );
  plusMatches?.forEach((match) => sizes.add(match));

  if (
    /\b(?:enterprise(?:s)?|large\s+(?:enterprise(?:s)?|business(?:es)?|compan(?:y|ies)|organizations?))\b/.test(
      lower,
    )
  ) {
    sizes.add("enterprise");
  }
  if (/\bmid[\s-]?(?:market|sized|size)\b|\bmedium[\s-]?sized\b/.test(lower)) {
    sizes.add("mid-market");
  }
  if (/\bstartups?\b/.test(lower)) sizes.add("startup");
  if (/\bsmall (?:business(?:es)?|compan(?:y|ies))\b/.test(lower)) {
    sizes.add("small");
  }
  if (
    /\bsmbs?\b|\bsmall(?:\s+and|\s*(?:to|[-–]))\s*(?:medium|mid[\s-]?market)\b/.test(
      lower,
    )
  ) {
    sizes.add("smb");
  }

  return [...sizes];
}

/** HarvestAPI resolves canonical LinkedIn autocomplete text, not geo URNs, for locations. */
export function parseLocationsFromText(text: string): string[] {
  const locations = new Set<string>();

  for (const alias of LOCATION_ALIASES) {
    if (alias.patterns.some((pattern) => pattern.test(text))) {
      locations.add(alias.location);
    }
  }

  return [...locations];
}

function inferJobTitlesFromAudience(audience: string): string[] {
  const lower = audience.toLowerCase();
  const titles = new Set<string>();

  if (/\bfounders?\b/.test(lower)) titles.add("Founder");
  if (/\bceos?\b|\bchief executive\b/.test(lower)) titles.add("CEO");
  if (/\bowners?\b/.test(lower)) titles.add("Owner");
  if (/\bfinance\b|\bcfos?\b|\bcontroller\b/.test(lower)) {
    titles.add("CFO");
    titles.add("VP Finance");
    titles.add("Head of Finance");
    titles.add("Controller");
  }
  if (/\bmarketing\b|\bcmos?\b/.test(lower)) {
    titles.add("CMO");
    titles.add("VP Marketing");
    titles.add("Head of Marketing");
  }
  if (/\bsales\b|\brevenue\b|\bcros?\b/.test(lower)) {
    titles.add("CRO");
    titles.add("VP Sales");
    titles.add("Head of Sales");
  }
  if (/\boperations?\b|\bcoos?\b/.test(lower)) {
    titles.add("COO");
    titles.add("Director of Operations");
  }
  if (/\bhr\b|\btalent\b|\bpeople\b/.test(lower)) {
    titles.add("CHRO");
    titles.add("Head of People");
    titles.add("VP Talent");
  }

  if (titles.size === 0) {
    titles.add("Founder");
    titles.add("CEO");
  }

  return [...titles].slice(0, 8);
}

export function buildStrategyFilters(input: {
  market: string;
  audience: string;
  offer: string;
  competitiveAdvantage?: string;
}): ICPFilters {
  const jobTitles = inferJobTitlesFromAudience(input.audience);
  const industries = input.market ? [input.market] : [];
  const demographicText = [
    input.market,
    input.audience,
    input.competitiveAdvantage ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    industries,
    jobTitles,
    companySizes: parseCompanySizesFromText(demographicText),
    locations: parseLocationsFromText(demographicText),
    // Do not use offer/product copy as LinkedIn profile search text. It usually describes
    // what the customer sells, not how buyers describe themselves. Role + industry filters
    // are the primary audience filters; add keywords only later when they are clearly
    // audience-language rather than product-language.
    keywords: undefined,
  };
}

export function buildCompanySearchPlan(input: {
  filters: ICPFilters;
  market: string;
  resolvedIndustryIds: readonly number[];
  resolvedCompanyHeadcount: readonly string[];
}): CompanySearchPlan {
  const marketQuery =
    input.resolvedIndustryIds.length === 0 ? input.market.trim() : "";
  const filters: ICPFilters = {
    ...input.filters,
    // The company actor supports free-text company queries. Use the Discovery market,
    // never offer/product copy, when there is no reliable LinkedIn industry ID.
    keywords: marketQuery ? [marketQuery] : undefined,
  };
  const canSearch = Boolean(
    input.resolvedIndustryIds.length ||
      input.resolvedCompanyHeadcount.length ||
      filters.locations.length ||
      filters.keywords?.some((keyword) => keyword.trim()),
  );

  return canSearch
    ? { filters, canSearch: true }
    : {
        filters,
        canSearch: false,
        reason: COMPANY_SEARCH_UNAVAILABLE_REASON,
      };
}
