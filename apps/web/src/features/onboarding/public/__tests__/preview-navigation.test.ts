import { describe, expect, it } from "vitest";
import { previewMobileReferenceHref, previewRouteHref, previewSelection } from "../preview-navigation";

describe("preview navigation", () => {
  it("derives a route from a named preview path", () => {
    expect(previewSelection(new URLSearchParams(), "/onboarding-preview/cta").route).toBe("cta");
    expect(previewSelection(new URLSearchParams("screen=01")).reference).toMatchObject({ route: "signup" });
  });

  it("uses named paths for explicit route selection", () => {
    expect(previewRouteHref(new URLSearchParams("screen=08&capture=1"), "connect-channels")).toBe("/onboarding-preview/connect-channels?capture=1");
  });

  it("keeps numbered fixtures addressable without route query parameters", () => {
    expect(previewMobileReferenceHref("04")).toBe("/onboarding-preview?screen=04");
    expect(previewMobileReferenceHref("10")).toBe("/onboarding-preview?screen=10");
  });
});
