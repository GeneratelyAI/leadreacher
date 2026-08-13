import { describe, expect, it, vi } from "vitest";
import { UnipileAdapter } from "../unipile.js";
import {
  normalizeUnipileProspect,
  UnipileProspectSearchProvider,
} from "../unipile-prospect-search.js";

const searchInput = {
  filters: {
    jobTitles: ["Founder"],
    industries: ["Software"],
    companySizes: [],
    locations: ["Canada"],
  },
  maxResults: 25,
};

describe("normalizeUnipileProspect", () => {
  it("maps a Classic LinkedIn search result into a neutral prospect", () => {
    const prospect = normalizeUnipileProspect({
      id: "ACo123",
      display_name: "Ada Lovelace",
      public_identifier: "ada-lovelace",
      headline: "Founder at Analytical Engines",
      location: "London, United Kingdom",
      network_distance: "SECOND_DEGREE",
      product: "classic",
    });

    expect(prospect).toMatchObject({
      linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Founder",
      company: "Analytical Engines",
      providerLinkedinId: "ACo123",
    });
  });

  it("drops anonymous results without a usable profile URL", () => {
    expect(normalizeUnipileProspect({
      id: "anonymous",
      display_name: "LinkedIn Member",
      network_distance: "OUT_OF_NETWORK",
      product: "classic",
    })).toBeNull();
  });

  it("drops provider placeholders instead of generating an undefined LinkedIn URL", () => {
    expect(normalizeUnipileProspect({
      id: "placeholder-id",
      display_name: "Clara Example",
      public_identifier: "undefined",
      profile_url: "https://www.linkedin.com/in/undefined",
      network_distance: "OUT_OF_NETWORK",
      product: "classic",
    })).toBeNull();
  });

  it("omits null provider fields from the import-safe profile", () => {
    const prospect = normalizeUnipileProspect({
      id: "ACo123",
      display_name: "Ada Lovelace",
      public_identifier: "ada-lovelace",
      location: null as unknown as string,
      industry: null as unknown as string,
      public_picture_url: null as unknown as string,
      network_distance: "SECOND_DEGREE",
      product: "classic",
    });

    expect(prospect).toEqual(expect.objectContaining({
      linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
      location: undefined,
      industry: undefined,
      avatarUrl: undefined,
    }));
  });

  it("uses the DSN-based search for legacy connected account IDs", async () => {
    const searchLinkedInPeopleLegacy = vi.fn().mockResolvedValue({ items: [], total_count: 0 });
    const listLinkedInRelations = vi.fn().mockResolvedValue([]);
    const adapter = {
      searchLinkedInPeopleLegacy,
      listLinkedInRelations,
    } as unknown as UnipileAdapter;
    const provider = new UnipileProspectSearchProvider(adapter, "legacy-account-id");

    await provider.searchPeople(searchInput);

    expect(searchLinkedInPeopleLegacy).toHaveBeenCalledWith(
      "legacy-account-id",
      { keywords: "Founder", network_distance: [1, 2, 3] },
      25,
      undefined,
    );
    expect(listLinkedInRelations).toHaveBeenCalledWith("legacy-account-id", 500);
  });

  it("uses v2 for new acc_ account IDs", async () => {
    const searchLinkedInPeople = vi.fn().mockResolvedValue({ data: [], total_count: 0 });
    const listLinkedInRelations = vi.fn().mockResolvedValue([]);
    const adapter = {
      searchLinkedInPeople,
      listLinkedInRelations,
    } as unknown as UnipileAdapter;
    const provider = new UnipileProspectSearchProvider(adapter, "acc_123");

    await provider.searchPeople(searchInput);

    expect(searchLinkedInPeople).toHaveBeenCalledWith(
      "acc_123",
      { keywords: "Founder", network_distance: [1, 2, 3] },
      25,
    );
    expect(listLinkedInRelations).toHaveBeenCalledWith("acc_123", 500);
  });

  it("falls back to matching first-degree connections when search is empty", async () => {
    const searchLinkedInPeopleLegacy = vi.fn().mockResolvedValue({ items: [], total_count: 0 });
    const listLinkedInRelations = vi.fn().mockResolvedValue([
      {
        member_id: "founder-id",
        first_name: "Ada",
        last_name: "Lovelace",
        headline: "Founder at Analytical Engines",
        public_profile_url: "https://www.linkedin.com/in/ada-lovelace/",
      },
      {
        member_id: "engineer-id",
        first_name: "Grace",
        last_name: "Hopper",
        headline: "Software Engineer",
        public_profile_url: "https://www.linkedin.com/in/grace-hopper/",
      },
    ]);
    const adapter = {
      searchLinkedInPeopleLegacy,
      listLinkedInRelations,
    } as unknown as UnipileAdapter;
    const provider = new UnipileProspectSearchProvider(adapter, "legacy-account-id");

    const result = await provider.searchPeople(searchInput);

    expect(result.totalFound).toBe(1);
    expect(result.profiles).toEqual([
      expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        providerLinkedinId: "founder-id",
        enrichmentData: expect.objectContaining({ networkDistance: "FIRST_DEGREE" }),
      }),
    ]);
  });
});
