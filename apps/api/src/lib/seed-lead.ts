export type SeedLeadInput = {
  orgId: string;
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  providerLinkedinId: string;
  company?: string;
  title?: string;
};

export type SeedLeadData = {
  orgId: string;
  source: "manual";
  status: "new";
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  providerLinkedinId: string;
  company: string;
  title: string;
  tags: string[];
  notes: string[];
  enrichmentData: Record<string, never>;
};

export function buildSeedLead(input: SeedLeadInput): SeedLeadData {
  return {
    orgId: input.orgId,
    source: "manual",
    status: "new",
    firstName: input.firstName,
    lastName: input.lastName,
    linkedinUrl: input.linkedinUrl,
    providerLinkedinId: input.providerLinkedinId,
    company: input.company ?? "",
    title: input.title ?? "",
    tags: [],
    notes: [],
    enrichmentData: {},
  };
}
