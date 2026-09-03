import type { Prisma } from "@prisma/client";
import type { ProspectProfile } from "../adapters/prospect-search.js";
import { prisma } from "../lib/prisma.js";
import { normalizePhoneE164 } from "../lib/phone.js";

export type CSVRow = {
  firstName: string;
  lastName: string;
  linkedinUrl?: string;
  email?: string;
  company?: string;
  title?: string;
  location?: string;
  phone?: string;
  instagramUsername?: string;
  whatsappConsentAt?: string;
  whatsappConsentSource?: string;
};

async function fetchExistingLinkedinUrls(
  orgId: string,
  linkedinUrls: string[],
): Promise<Set<string>> {
  const uniqueUrls = [...new Set(linkedinUrls)];
  if (uniqueUrls.length === 0) {
    return new Set();
  }

  const existing = await prisma.lead.findMany({
    where: {
      orgId,
      linkedinUrl: { in: uniqueUrls },
    },
    select: { linkedinUrl: true },
  });

  return new Set(
    existing
      .map((lead: { linkedinUrl: string | null }) => lead.linkedinUrl)
      .filter((url: string | null): url is string => url != null),
  );
}

function isDuplicateLinkedinUrl(
  linkedinUrl: string,
  existing: Set<string>,
  seenInBatch: Set<string>,
): boolean {
  if (existing.has(linkedinUrl) || seenInBatch.has(linkedinUrl)) {
    return true;
  }
  seenInBatch.add(linkedinUrl);
  return false;
}

export async function importProspectProfiles(
  orgId: string,
  profiles: ProspectProfile[],
  source: "apify" | "linkedin" | "sales_navigator",
): Promise<{ imported: number; skipped: number; leadIds: string[] }> {
  const profileUrls = [...new Set(profiles.map((profile) => profile.linkedinUrl))];
  const existingUrls = await fetchExistingLinkedinUrls(
    orgId,
    profileUrls,
  );
  const seenInBatch = new Set<string>();
  const toCreate: Prisma.LeadCreateManyInput[] = [];
  let skipped = 0;

  for (const profile of profiles) {
    if (isDuplicateLinkedinUrl(profile.linkedinUrl, existingUrls, seenInBatch)) {
      skipped += 1;
      continue;
    }

    toCreate.push({
      orgId,
      source,
      status: "new",
      tags: [],
      notes: [],
      linkedinUrl: profile.linkedinUrl,
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      company: profile.company,
      location: profile.location,
      industry: profile.industry,
      companySize: profile.companySize,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      providerLinkedinId: profile.providerLinkedinId,
      enrichmentData: profile.enrichmentData as Prisma.InputJsonValue,
    });
  }

  if (toCreate.length === 0) {
    const existingLeads = await prisma.lead.findMany({
      where: { orgId, linkedinUrl: { in: profileUrls } },
      select: { id: true },
    });
    return {
      imported: 0,
      skipped,
      leadIds: existingLeads.map((lead) => lead.id),
    };
  }

  const { count } = await prisma.lead.createMany({ data: toCreate });
  const importedLeads = await prisma.lead.findMany({
    where: { orgId, linkedinUrl: { in: profileUrls } },
    select: { id: true },
  });
  return {
    imported: count,
    skipped,
    leadIds: importedLeads.map((lead) => lead.id),
  };
}

export async function importFromCSV(
  orgId: string,
  rows: CSVRow[],
): Promise<{ imported: number; skipped: number }> {
  const linkedinUrls = rows
    .map((row) => row.linkedinUrl)
    .filter((url): url is string => url != null && url.length > 0);

  const existingUrls = await fetchExistingLinkedinUrls(orgId, linkedinUrls);
  const seenInBatch = new Set<string>();
  const toCreate: Prisma.LeadCreateManyInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.firstName || !row.lastName) {
      skipped += 1;
      continue;
    }

    if (
      row.linkedinUrl &&
      isDuplicateLinkedinUrl(row.linkedinUrl, existingUrls, seenInBatch)
    ) {
      skipped += 1;
      continue;
    }

    toCreate.push({
      orgId,
      source: "csv",
      status: "new",
      tags: [],
      notes: [],
      firstName: row.firstName,
      lastName: row.lastName,
      linkedinUrl: row.linkedinUrl,
      email: row.email,
      company: row.company ?? "",
      title: row.title ?? "",
      location: row.location,
      phone: normalizePhoneE164(row.phone),
      instagramUsername: row.instagramUsername?.replace(/^@/, ""),
      instagramIdentityStatus: row.instagramUsername ? "unresolved" : undefined,
      whatsappConsentAt: row.whatsappConsentAt ? new Date(row.whatsappConsentAt) : undefined,
      whatsappConsentSource: row.whatsappConsentSource?.trim() || undefined,
    });
  }

  if (toCreate.length === 0) {
    return { imported: 0, skipped };
  }

  const { count } = await prisma.lead.createMany({ data: toCreate });
  return { imported: count, skipped };
}
