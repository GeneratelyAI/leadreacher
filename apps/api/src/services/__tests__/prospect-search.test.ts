import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ExternalServiceError } from "../../lib/errors.js";

const { findMany, update, searchPeople, importProspectProfiles } = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  searchPeople: vi.fn(),
  importProspectProfiles: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: { socialAccount: { findMany, update } },
}));
vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_DSN: "api.example.test", UNIPILE_API_KEY: "test-key" },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {},
}));
vi.mock("../../adapters/unipile-prospect-search.js", () => ({
  UnipileProspectSearchProvider: class {
    searchPeople = searchPeople;
  },
}));
vi.mock("../lead-import.js", () => ({ importProspectProfiles }));

import { searchAndImportLinkedInProspects } from "../prospect-search.js";

const input = {
  filters: {
    jobTitles: ["Founder"],
    industries: [],
    companySizes: [],
    locations: [],
  },
  maxResults: 25,
};

beforeEach(() => {
  findMany.mockReset();
  update.mockReset();
  searchPeople.mockReset();
  importProspectProfiles.mockReset();
});

describe("searchAndImportLinkedInProspects", () => {
  it("requires an active connected LinkedIn account", async () => {
    findMany.mockResolvedValue([]);

    await expect(searchAndImportLinkedInProspects("org-1", input)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(searchPeople).not.toHaveBeenCalled();
  });

  it("searches and imports through the connected account", async () => {
    const profile = {
      linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Founder",
      company: "Analytical Engines",
      enrichmentData: {},
    };
    findMany.mockResolvedValue([{ id: "social-account-1", unipileId: "legacy-account-id" }]);
    searchPeople.mockResolvedValue({ profiles: [profile], totalFound: 12 });
    importProspectProfiles.mockResolvedValue({ imported: 1, skipped: 0, leadIds: ["lead-1"] });

    await expect(searchAndImportLinkedInProspects("org-1", input)).resolves.toEqual({
      imported: 1,
      skipped: 0,
      total: 1,
      totalFound: 12,
      leadIds: ["lead-1"],
    });
    expect(importProspectProfiles).toHaveBeenCalledWith("org-1", [profile], "linkedin");
  });

  it("uses the selected LinkedIn sender when one is supplied", async () => {
    findMany.mockResolvedValue([{ id: "social-account-2", unipileId: "selected-account-id" }]);
    searchPeople.mockResolvedValue({ profiles: [], totalFound: 0 });
    importProspectProfiles.mockResolvedValue({ imported: 0, skipped: 0, leadIds: [] });

    await searchAndImportLinkedInProspects("org-1", input, { socialAccountId: "social-account-2" });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "social-account-2" }),
    }));
  });

  it("marks unavailable accounts for reconnection and tries another active sender", async () => {
    findMany.mockResolvedValue([
      { id: "stale-account", unipileId: "stale-unipile-account" },
      { id: "healthy-account", unipileId: "healthy-unipile-account" },
    ]);
    searchPeople
      .mockRejectedValueOnce(new ExternalServiceError("Unipile", "Account not found"))
      .mockResolvedValueOnce({ profiles: [], totalFound: 0 });
    importProspectProfiles.mockResolvedValue({ imported: 0, skipped: 0, leadIds: [] });

    await expect(searchAndImportLinkedInProspects("org-1", input)).resolves.toMatchObject({
      total: 0,
      totalFound: 0,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "stale-account" },
      data: { status: "error" },
    });
    expect(searchPeople).toHaveBeenCalledTimes(2);
  });

  it("explains when every connected LinkedIn account has been removed upstream", async () => {
    findMany.mockResolvedValue([{ id: "stale-account", unipileId: "stale-unipile-account" }]);
    searchPeople.mockRejectedValue(new ExternalServiceError("Unipile", "Account not found"));

    await expect(searchAndImportLinkedInProspects("org-1", input)).rejects.toMatchObject({
      message: "Your LinkedIn connection is no longer available. Reconnect LinkedIn in Channels, then try again.",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "stale-account" },
      data: { status: "error" },
    });
  });
});
