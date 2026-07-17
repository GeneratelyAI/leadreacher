import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const { scrapeLeads, importScrapedProfiles } = vi.hoisted(() => ({
  scrapeLeads: vi.fn(),
  importScrapedProfiles: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: { APIFY_API_KEY: "test-token" },
}));
vi.mock("../../adapters/apify.js", () => ({
  ApifyAdapter: class {
    scrapeLeads = scrapeLeads;
  },
}));
vi.mock("../../services/lead-import.js", () => ({
  importScrapedProfiles,
  importFromCSV: vi.fn(),
}));

import { leadsRoutes } from "../leads.js";

async function buildTestApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: error.message });
    }
    throw error;
  });
  await app.register(leadsRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  scrapeLeads.mockReset();
  importScrapedProfiles.mockReset();
  scrapeLeads.mockResolvedValue([]);
  importScrapedProfiles.mockResolvedValue({ imported: 0, skipped: 0 });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /leads/scrape", () => {
  it("rejects malformed filters before invoking Apify", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/leads/scrape",
      payload: {
        filters: { jobTitles: "CFO" },
        maxResults: 25,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(scrapeLeads).not.toHaveBeenCalled();
  });

  it("passes validated filters and maxResults to the Apify adapter", async () => {
    const filters = {
      jobTitles: ["CFO"],
      industries: ["Accounting"],
      companySizes: ["50-200 employees"],
      locations: ["Canada"],
      keywords: ["finance"],
    };
    const response = await app.inject({
      method: "POST",
      url: "/leads/scrape",
      payload: { filters, maxResults: 25 },
    });

    expect(response.statusCode).toBe(200);
    expect(scrapeLeads).toHaveBeenCalledWith(filters, 25);
    expect(importScrapedProfiles).toHaveBeenCalledWith("org-1", []);
  });
});
