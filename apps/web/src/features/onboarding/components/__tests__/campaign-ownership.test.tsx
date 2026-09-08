import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CampaignCanvas } from "../../public/canvas";
import { Pill } from "../../public/pill";
import type { PillProps } from "../../public/campaign-summary";
import CampaignContent from "../steps/CampaignContent";
import PersonalizedVideoStyle from "../steps/PersonalizedVideoStyle";
import AiVideoStyle from "../steps/AiVideoStyle";
import UploadYourVideo from "../steps/UploadYourVideo";
import UploadDocument from "../steps/UploadDocument";
import Discovery from "../steps/Discovery";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../../public/mobile-header", () => ({ default: () => null }));
vi.mock("../../public/website-status", () => ({
  useWebsiteScrapeStatus: () => ({
    websiteUrl: "https://saved.example",
    status: { status: "completed", url: "https://saved.example", market: "Software", offer: "Sales planning", audience: "Revenue teams", value: "Less manual work", strategyStatus: "Plan outreach" },
  }),
}));
vi.mock("../PillView", () => ({
  PillView: ({ campaign }: PillProps) => <output data-campaign-summary>{JSON.stringify(campaign)}</output>,
}));

describe("campaign presentation ownership", () => {
  it.each([
    ["discovery", <Discovery key="discovery" />],
    ["content", <CampaignContent key="content" />],
    ["personalized style", <PersonalizedVideoStyle key="personalized" preview />],
    ["AI style", <AiVideoStyle key="ai" preview />],
    ["video upload", <UploadYourVideo key="video" preview />],
    ["document upload", <UploadDocument key="document" preview />],
  ])("keeps one saved-data summary when rendering %s", (_name, scene) => {
    const html = renderToStaticMarkup(<CampaignCanvas>{scene}</CampaignCanvas>);
    expect(html.match(/data-campaign-summary/g)).toHaveLength(1);
    expect(html).toContain("saved.example");
    expect(html).toContain("Sales planning");
    expect(html).toContain("Not selected");
    expect(html).not.toContain("Choosing content");
  });

  it("renders an independently supplied authentication summary", () => {
    const html = renderToStaticMarkup(<Pill campaign={{ fields: [], site: { label: "signup.example", iconUrl: "/logo/leadreacher_icon_colored.svg" }, status: "learning" }} />);
    expect(html.match(/data-campaign-summary/g)).toHaveLength(1);
    expect(html).toContain("signup.example");
  });
});
