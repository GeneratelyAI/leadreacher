import { describe, expect, it } from "vitest";
import {
  previewMobileReferenceHref,
  previewStepHref,
  previewStrategyHref,
} from "../preview-navigation";

describe("preview navigation", () => {
  it("clears a mobile fixture when an explicit onboarding step is selected", () => {
    const href = previewStepHref(
      new URLSearchParams("screen=08&step=campaign-content&media=placeholder&capture=1"),
      "channels",
    );

    expect(href).toBe("/onboarding-preview?step=channels&capture=1");
  });

  it("keeps the Strategy substep explicit in the URL", () => {
    const href = previewStrategyHref(new URLSearchParams("screen=04&step=strategy"), "targeting");

    expect(href).toBe("/onboarding-preview?step=strategy&substep=targeting");
  });

  it("returns a fully addressable mobile fixture URL", () => {
    expect(previewMobileReferenceHref("04")).toBe(
      "/onboarding-preview?screen=04&step=strategy&substep=how-it-works",
    );
    expect(previewMobileReferenceHref("10")).toBe(
      "/onboarding-preview?screen=10&step=ai-video-style&media=placeholder",
    );
  });
});
