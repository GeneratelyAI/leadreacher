import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const {
  importProspectProfiles,
  searchAndImportLinkedInProspects,
  searchLinkedInProspects,
} = vi.hoisted(() => ({
  importProspectProfiles: vi.fn(),
  searchAndImportLinkedInProspects: vi.fn(),
  searchLinkedInProspects: vi.fn(),
}));

vi.mock("../../services/prospect-search.js", () => ({
  searchAndImportLinkedInProspects,
  searchLinkedInProspects,
}));
vi.mock("../../services/lead-import.js", () => ({
  importFromCSV: vi.fn(),
  importProspectProfiles,
}));

import { leadsRoutes } from "../leads.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Validation failed";
    if (error instanceof ZodError || (error as { code?: string }).code === "FST_ERR_VALIDATION") {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message });
    }
    throw error;
  });
  await app.register(leadsRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  searchAndImportLinkedInProspects.mockReset();
  searchLinkedInProspects.mockReset();
  importProspectProfiles.mockReset();
  searchAndImportLinkedInProspects.mockResolvedValue({
    imported: 2,
    skipped: 0,
    total: 2,
    totalFound: 20,
  });
  searchLinkedInProspects.mockResolvedValue({
    profiles: [
      {
        linkedinUrl: "https://www.linkedin.com/in/sarah-test",
        firstName: "Sarah",
        lastName: "Test",
        title: "Founder",
        company: "Common Thread",
        enrichmentData: {},
      },
    ],
    totalFound: 1,
  });
  importProspectProfiles.mockResolvedValue({ imported: 1, skipped: 0, leadIds: ["lead-1"] });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /prospects/search", () => {
  it("rejects malformed filters before invoking the provider", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/prospects/search",
      payload: { filters: { jobTitles: "CFO" }, maxResults: 25 },
    });

    expect(response.statusCode).toBe(400);
    expect(searchAndImportLinkedInProspects).not.toHaveBeenCalled();
  });

  it("passes validated filters to connected LinkedIn search", async () => {
    const filters = {
      jobTitles: ["CFO"],
      industries: ["Accounting"],
      companySizes: ["51-200"],
      locations: ["Canada"],
      keywords: ["finance"],
    };
    const response = await app.inject({
      method: "POST",
      url: "/prospects/search",
      payload: { filters, maxResults: 25 },
    });

    expect(response.statusCode).toBe(200);
    expect(searchAndImportLinkedInProspects).toHaveBeenCalledWith("org-1", {
      filters,
      maxResults: 25,
    });
    expect(response.json()).toMatchObject({ imported: 2, total: 2, totalFound: 20 });
  });

  it("accepts a LinkedIn people search URL", async () => {
    const searchUrl = "https://www.linkedin.com/search/results/people/?keywords=founder";
    const response = await app.inject({
      method: "POST",
      url: "/prospects/search",
      payload: {
        filters: { jobTitles: [], industries: [], companySizes: [], locations: [] },
        searchUrl,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(searchAndImportLinkedInProspects).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ searchUrl, maxResults: 25 }),
    );
  });
});

describe("direct prospect add", () => {
  const filters = {
    jobTitles: [],
    industries: [],
    companySizes: [],
    locations: [],
    keywords: ["Sarah Test"],
  };

  it("previews LinkedIn profiles without importing them", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/prospects/search/preview",
      payload: { filters, maxResults: 8 },
    });

    expect(response.statusCode).toBe(200);
    expect(searchLinkedInProspects).toHaveBeenCalledWith("org-1", { filters, maxResults: 8 });
    expect(importProspectProfiles).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({ totalFound: 1, profiles: [{ firstName: "Sarah" }] });
  });

  it("imports only the reviewed profile", async () => {
    const profile = {
      linkedinUrl: "https://www.linkedin.com/in/sarah-test",
      firstName: "Sarah",
      lastName: "Test",
      title: "Founder",
      company: "Common Thread",
      enrichmentData: {},
    };
    const response = await app.inject({
      method: "POST",
      url: "/prospects/import",
      payload: { profile },
    });

    expect(response.statusCode).toBe(200);
    expect(importProspectProfiles).toHaveBeenCalledWith("org-1", [profile], "linkedin");
    expect(response.json()).toEqual({ imported: 1, skipped: 0, leadId: "lead-1" });
  });
});
