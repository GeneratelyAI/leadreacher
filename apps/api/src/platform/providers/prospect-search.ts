export type ProspectSearchFilters = {
  jobTitles: string[];
  industries: string[];
  companySizes: string[];
  locations: string[];
  keywords?: string[];
};

export type ProspectProfile = {
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
  avatarUrl?: string;
  enrichmentData: Record<string, unknown>;
};

export type ProspectSearchInput = {
  filters: ProspectSearchFilters;
  maxResults: number;
  searchUrl?: string;
};

export type ProspectSearchResult = {
  profiles: ProspectProfile[];
  totalFound: number;
};

export interface ProspectSearchProvider {
  searchPeople(input: ProspectSearchInput): Promise<ProspectSearchResult>;
}
