import { afterEach, describe, expect, it, vi } from "vitest";
import { ApifyAdapter, type ICPFilters } from "../apify.js";

const filters: ICPFilters = {
  jobTitles: ["CRO"],
  industries: ["B2B data and sales enablement"],
  companySizes: [],
  locations: [],
  keywords: ["AI-powered B2B data research and sales automation platform"],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Apify adapter normalization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts email strings from Full + email search email objects", async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs/profile-run")) {
          return jsonResponse({ data: { status: "SUCCEEDED" } });
        }
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs")) {
          return jsonResponse({ data: { id: "profile-run" } });
        }
        if (url.includes("/actor-runs/profile-run/dataset/items")) {
          return jsonResponse([
            {
              id: "ACoAAB7crHEBs6xW-3r5WpszCvqbMO9bc0PdnaQ",
              _meta: {
                pagination: {
                  totalElements: 17,
                },
              },
              publicIdentifier: "noah-sturm-augment",
              linkedinUrl: "https://www.linkedin.com/in/noah-sturm-augment",
              firstName: "Noah",
              lastName: "Sturm",
              emails: [
                {
                  email: "noah@augment.co",
                  deliverable: true,
                  status: "valid",
                  qualityScore: 80,
                },
              ],
              headline: "AI Should Improve Decisions, Not Replace Relationships | SVP Sales at Augment AI",
              currentPosition: [
                {
                  companyName: "Augment AI",
                  position: "Senior Vice President of Global Sales",
                },
              ],
            },
          ]);
        }
        return jsonResponse({});
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const { profiles, totalFound } = await adapter.scrapeLeadsWithTotal(filters, 1);

    expect(profiles).toHaveLength(1);
    expect(totalFound).toBe(17);
    expect(profiles[0]?.email).toBe("noah@augment.co");
    expect(profiles[0]?.title).toBe("Senior Vice President of Global Sales");
  });

  it("forwards resolved industry and company-headcount filters to the profile actor", async () => {
    const requests: Array<{ url: string; body?: string }> = [];
    const fetchMock = vi.fn(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        const url = input instanceof Request ? input.url : input.toString();
        requests.push({ url, body: init?.body?.toString() });
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs/profile-run")) {
          return jsonResponse({ data: { status: "SUCCEEDED" } });
        }
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs")) {
          return jsonResponse({ data: { id: "profile-run" } });
        }
        if (url.includes("/actor-runs/profile-run/dataset/items")) {
          return jsonResponse([]);
        }
        return jsonResponse({});
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    await adapter.scrapeLeadsWithTotal(
      {
        jobTitles: ["CFO"],
        industries: ["Accounting"],
        companySizes: ["50-200 employees"],
        locations: [],
      },
      1,
      { profileScraperMode: "Full" },
    );

    const startRequest = requests.find(({ url }) =>
      url.includes("/acts/harvestapi~linkedin-profile-search/runs"),
    );
    expect(JSON.parse(startRequest?.body ?? "{}")).toMatchObject({
      industryIds: [47],
      companyHeadcount: ["D"],
      takePages: 1,
      profileScraperMode: "Full",
    });
  });

  it("uses totalElements for profile totals when it is the only reported total", async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs/profile-run")) {
          return jsonResponse({ data: { status: "SUCCEEDED" } });
        }
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs")) {
          return jsonResponse({ data: { id: "profile-run" } });
        }
        if (url.includes("/actor-runs/profile-run/dataset/items")) {
          return jsonResponse([
            {
              _meta: {
                pagination: {
                  totalElements: 11_529_871,
                },
              },
              linkedinUrl: "https://www.linkedin.com/in/founder-example",
              firstName: "Alex",
              lastName: "Founder",
            },
          ]);
        }
        return jsonResponse({});
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const { totalFound } = await adapter.scrapeLeadsWithTotal(filters, 1);

    expect(totalFound).toBe(11_529_871);
  });

  it("prefers structured current-position titles over bio-style headlines", async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs/profile-run")) {
          return jsonResponse({ data: { status: "SUCCEEDED" } });
        }
        if (url.includes("/acts/harvestapi~linkedin-profile-search/runs")) {
          return jsonResponse({ data: { id: "profile-run" } });
        }
        if (url.includes("/actor-runs/profile-run/dataset/items")) {
          return jsonResponse([
            {
              linkedinUrl: "https://www.linkedin.com/in/prateek-varshney",
              firstName: "Prateek",
              lastName: "Varshney",
              headline:
                "AI and software consultant. Open-source contributor. IIT Kharagpur grad and post-grad. ex-Goldman Sachs, Practo, Xperi",
              currentPosition: [
                { position: "Founder & Principal Consultant" },
              ],
            },
            {
              linkedinUrl: "https://www.linkedin.com/in/nagendra-s",
              firstName: "Nagendra",
              lastName: "S",
              headline:
                "Founder, MapTrix AI | Evidence based automated underwriting triage for US P&C insurance |",
              currentPosition: [{ position: "Founder & CEO" }],
            },
            {
              linkedinUrl: "https://www.linkedin.com/in/abhimanyu-rathi",
              firstName: "Abhimanyu",
              lastName: "Rathi",
              headline: "Founder & CEO, RenewCred Carbon Credits Standard & Registry",
              currentPosition: [{ position: "Founder & CEO" }],
            },
            {
              linkedinUrl: "https://www.linkedin.com/in/vinayak-satpute",
              firstName: "Vinayak",
              lastName: "Satpute",
              headline:
                "Empowering businesses to lead in ESG & Sustainability with technology-driven compliance, carbon intelligence, and climate strategy | Founder & CEO, Switch Climate Tech |",
              currentPosition: [{ position: "Founder and CEO" }],
            },
          ]);
        }
        return jsonResponse({});
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const { profiles } = await adapter.scrapeLeadsWithTotal(filters, 4);

    expect(profiles.map((profile) => profile.title)).toEqual([
      "Founder & Principal Consultant",
      "Founder & CEO",
      "Founder & CEO",
      "Founder and CEO",
    ]);
  });

  it("uses the actor-aligned totalElements instead of undocumented totalResultCount", async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/acts/harvestapi~linkedin-company-search/runs/company-run")) {
          return jsonResponse({ data: { status: "SUCCEEDED" } });
        }
        if (url.includes("/acts/harvestapi~linkedin-company-search/runs")) {
          return jsonResponse({ data: { id: "company-run" } });
        }
        if (url.includes("/actor-runs/company-run/dataset/items")) {
          return jsonResponse([
            {
              id: "115978259",
              _meta: {
                pagination: {
                  totalElements: 1000,
                  totalResultCount: 142_857,
                },
              },
              universalName: "brazn-ai",
              linkedinUrl: "https://www.linkedin.com/company/brazn-ai/",
              name: "Brazn AI - Your AI Sales Copilot",
              industries: [
                {
                  id: "6",
                  name: "Technology, Information and Internet",
                  title: "Technology, Information and Internet",
                },
              ],
              employeeCount: 0,
              employeeCountRange: {
                start: 2,
                end: 10,
              },
            },
          ]);
        }
        return jsonResponse({});
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const { companies, totalFound } = await adapter.searchCompanies(filters, 1);

    expect(companies).toHaveLength(1);
    expect(totalFound).toBe(1000);
    expect(companies[0]?.industry).toBe("Technology, Information and Internet");
  });

  it("does not start a company actor when no real search criterion is available", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const result = await adapter.searchCompanies({
      jobTitles: ["Founder"],
      industries: [],
      companySizes: [],
      locations: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      companies: [],
      totalFound: 0,
      skipped: true,
      reason:
        "Company search requires an industry, company size, location, or market query.",
    });
  });
});
