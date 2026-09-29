import type { ButtonHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteScrapeStatus } from "../../public/website-status";
import HowItWorks from "../steps/HowItWorks";

const mocks = vi.hoisted(() => ({
  scrape: vi.fn(), retry: vi.fn(), fetch: vi.fn(), begin: vi.fn(), navigate: vi.fn(), restore: vi.fn(),
  buttons: [] as ButtonHTMLAttributes<HTMLButtonElement>[],
}));
vi.mock("../../public/website-status", () => ({ useWebsiteScrapeStatus: mocks.scrape }));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("@/lib/api")>(), apiFetch: mocks.fetch }));
vi.mock("../../public/navigation", () => ({
  onboardingHref: (route: string) => `/onboarding/${route}`,
  beginOnboardingNavigation: mocks.begin, navigateOnboarding: mocks.navigate, restoreOnboardingNavigation: mocks.restore,
}));
vi.mock("../steps/HowItWorksIllustrations", () => ({ HowItWorksIllustration: () => null, useHowItWorksStory: () => {} }));
vi.mock("@/hooks/useStableReducedMotion", () => ({ useStableReducedMotion: () => true }));
vi.mock("@/components/ui/animated-highlight-text", () => ({ SparklesIcon: () => null }));
vi.mock("@/components/ui/shimmer-text", () => ({ default: ({ children }: { children: string }) => children }));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
    void _variant;
    mocks.buttons.push(props);
    return <button {...props} />;
  },
}));

const complete: WebsiteScrapeStatus = {
  status: "completed", url: "https://example.com", market: " Software ", offer: " Workflow automation ",
  audience: " Sales teams ", value: " Saves time ", strategyStatus: "Prepare outreach", error: null,
};
const empty: WebsiteScrapeStatus = { ...complete, status: "idle", market: "", offer: "", audience: "", value: "" };
function setScrape(status: WebsiteScrapeStatus, overrides: Record<string, unknown> = {}) {
  mocks.scrape.mockReturnValue({ status, websiteUrl: status.url, ready: true, loading: false, retry: mocks.retry, ...overrides });
}
function continueButton() {
  return mocks.buttons.find((button) => button.className === "onboarding-campaign-next")!;
}
async function click(button: ButtonHTMLAttributes<HTMLButtonElement>) {
  await button.onClick?.({} as Parameters<NonNullable<typeof button.onClick>>[0]);
}

describe("HowItWorks analysis readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buttons.length = 0;
    mocks.begin.mockReturnValue(true);
    mocks.fetch.mockResolvedValue({ strategyId: "strategy-1" });
    mocks.retry.mockResolvedValue({ ...empty, status: "running" });
    setScrape(complete);
  });

  it.each([
    ["initial status restoration", empty, { ready: false }],
    ["loading saved analysis", complete, { loading: true }],
    ["running analysis", { ...empty, status: "running" }, {}],
    ["running analysis with old fields", { ...complete, status: "running" }, {}],
    ["failed analysis", { ...empty, status: "failed" }, {}],
    ["idle analysis", empty, {}],
    ["partial completed analysis", { ...empty, status: "completed", market: "Software" }, {}],
    ["whitespace-only summary", { ...complete, offer: "  ", market: "\t", audience: "\n", value: " " }, {}],
  ] as const)("blocks both the button and request during %s", async (_name, status, overrides) => {
    setScrape(status, overrides);
    const html = renderToStaticMarkup(<HowItWorks />);
    expect(continueButton().disabled).toBe(true);
    expect(html).toMatch(/role="(status|alert)"/);
    await click(continueButton());
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("explains loading and enables continuation after analysis arrives", async () => {
    setScrape(empty, { ready: false });
    expect(renderToStaticMarkup(<HowItWorks />)).toContain("Analyzing your website.");
    expect(continueButton().disabled).toBe(true);
    mocks.buttons.length = 0;
    setScrape(complete);
    renderToStaticMarkup(<HowItWorks />);
    expect(continueButton().disabled).toBe(false);
    await click(continueButton());
    const [path, options] = mocks.fetch.mock.calls[0]!;
    expect(path).toBe("/discovery/complete");
    expect(JSON.parse(options.body)).toMatchObject({
      mode: "introduction", websiteUrl: "https://example.com",
      summary: { businessModel: "Workflow automation", industry: "Software", strengths: "Saves time", idealCustomer: "Sales teams" },
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/onboarding/discovery");
  });

  it("uses nonempty fallback fields without inventing business details", async () => {
    setScrape({ ...complete, offer: " \t", audience: "\n" });
    renderToStaticMarkup(<HowItWorks />);
    expect(continueButton().disabled).toBe(false);
    await click(continueButton());
    expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body).summary).toMatchObject({
      businessModel: "Software", industry: "Software", strengths: "Saves time", idealCustomer: "Software",
    });
  });

  it.each(["failed", "completed"] as const)("offers retry and website correction for %s analysis with missing details", async (status) => {
    setScrape({ ...empty, status });
    const html = renderToStaticMarkup(<HowItWorks />);
    expect(html).toContain("business details needed to continue");
    await click(mocks.buttons.find((button) => button.children === "Retry analysis")!);
    expect(mocks.retry).toHaveBeenCalledOnce();
    await click(mocks.buttons.find((button) => button.children === "Check website address")!);
    expect(mocks.navigate).toHaveBeenCalledWith("/onboarding/discovery?view=website");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("offers website entry when no website is saved", () => {
    setScrape({ ...empty, url: null });
    const html = renderToStaticMarkup(<HowItWorks />);
    expect(html).toContain("Enter your website address");
    expect(html).not.toContain("Retry analysis");
    expect(continueButton().disabled).toBe(true);
  });

  it("restores navigation when saving fails", async () => {
    mocks.fetch.mockRejectedValue(new Error("Unable to save"));
    renderToStaticMarkup(<HowItWorks />);
    await click(continueButton());
    expect(mocks.restore).toHaveBeenCalledOnce();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
