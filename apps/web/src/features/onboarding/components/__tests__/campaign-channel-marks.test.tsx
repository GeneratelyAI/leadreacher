import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CampaignChannelDetails,
  CampaignChannelMarks,
  campaignChannels,
} from "../CampaignChannelMarks";
import type { PillSection } from "../../public/campaign-summary";

const section: PillSection = {
  id: "channels",
  label: "Channels",
  state: "complete",
  fields: [{
    label: "Selected channels",
    values: ["linkedin", "whatsapp", "instagram", "facebook", "email"],
  }],
};

describe("CampaignChannelMarks", () => {
  it("preserves saved order and exposes only supported channel marks", () => {
    expect(campaignChannels({
      ...section,
      fields: [{ label: "Selected channels", values: ["linkedin", "unknown", "email", "facebook"] }],
    }).map((channel) => channel.id)).toEqual(["linkedin", "gmail", "facebook"]);
  });

  it("renders accessible compact marks and expanded channel labels", () => {
    const channels = campaignChannels(section);
    const compact = renderToStaticMarkup(<CampaignChannelMarks channels={channels} />);
    const expanded = renderToStaticMarkup(<CampaignChannelDetails channels={channels} />);

    expect(compact).toContain('aria-label="Selected channels"');
    expect(compact).toContain('aria-label="LinkedIn"');
    expect(compact).toContain('aria-label="WhatsApp"');
    expect(expanded).toContain("LinkedIn");
    expect(expanded).toContain("WhatsApp");
    expect(expanded).toContain("Instagram");
    expect(expanded).toContain("Facebook");
    expect(expanded).toContain("Gmail");
  });
});
