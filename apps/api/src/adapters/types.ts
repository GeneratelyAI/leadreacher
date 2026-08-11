export type UnipileCredentials = {
  dsn: string;
  apiKey: string;
};

export type UnipileNetworkDistance =
  | "FIRST_DEGREE"
  | "SECOND_DEGREE"
  | "THIRD_DEGREE"
  | "OUT_OF_NETWORK";

export type UnipileProfile = {
  provider_id: string;
  provider_messaging_id?: string;
  messaging_identifier?: string;
  public_identifier: string;
  first_name: string;
  last_name: string;
  headline: string;
  network_distance: UnipileNetworkDistance | string;
  is_relationship: boolean;
};

export type {
  ApifyCredentials,
  ICPFilters,
  ScrapedCompany,
  ScrapedProfile,
} from "./apify.js";

export type {
  ProspectProfile,
  ProspectSearchFilters,
  ProspectSearchInput,
  ProspectSearchProvider,
  ProspectSearchResult,
} from "./prospect-search.js";
