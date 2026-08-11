import { describe, expect, it } from "vitest";
import { CampaignNamingSchema, formatCampaignName } from "../campaign-naming.js";

describe("campaign naming", () => {
  it("normalizes the structured metadata into the canonical display name", () => {
    const naming = CampaignNamingSchema.parse({
      audience: "  Revenue leaders  ",
      channelLabel: "LinkedIn",
      goal: "  Start conversations ",
    });

    expect(naming).toEqual({
      audience: "Revenue leaders",
      channelLabel: "LinkedIn",
      goal: "Start conversations",
    });
    expect(formatCampaignName(naming)).toBe("Revenue leaders · LinkedIn · Start conversations");
  });

  it("rejects empty naming fields", () => {
    expect(() => CampaignNamingSchema.parse({ audience: "", channelLabel: "LinkedIn", goal: "Start conversations" })).toThrow();
  });
});
