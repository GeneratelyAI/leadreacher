import { describe, expect, it } from "vitest";
import { getSlideDirection } from "../StepMotion";
import { ONBOARDING_STEPS, STRATEGY_SUBSTEPS } from "../steps/steps";

describe("getSlideDirection", () => {
  it("slides forward through every onboarding step", () => {
    for (let index = 0; index < ONBOARDING_STEPS.length - 1; index += 1) {
      expect(
        getSlideDirection(ONBOARDING_STEPS[index]!.value, ONBOARDING_STEPS[index + 1]!.value),
      ).toBe("forward");
    }
  });

  it("slides backward through every onboarding step", () => {
    for (let index = ONBOARDING_STEPS.length - 1; index > 0; index -= 1) {
      expect(
        getSlideDirection(ONBOARDING_STEPS[index]!.value, ONBOARDING_STEPS[index - 1]!.value),
      ).toBe("backward");
    }
  });

  it("uses the same direction rules for every Strategy substep", () => {
    for (let index = 0; index < STRATEGY_SUBSTEPS.length - 1; index += 1) {
      expect(getSlideDirection(STRATEGY_SUBSTEPS[index]!, STRATEGY_SUBSTEPS[index + 1]!)).toBe(
        "forward",
      );
      expect(getSlideDirection(STRATEGY_SUBSTEPS[index + 1]!, STRATEGY_SUBSTEPS[index]!)).toBe(
        "backward",
      );
    }
  });

  it("slides through Strategy subpages and adjacent onboarding pages in flow order", () => {
    const flow = [
      "discovery",
      "strategy:how-it-works",
      "strategy:targeting",
      "strategy:channels",
      "campaign-type",
    ];

    for (let index = 0; index < flow.length - 1; index += 1) {
      expect(getSlideDirection(flow[index]!, flow[index + 1]!)).toBe("forward");
      expect(getSlideDirection(flow[index + 1]!, flow[index]!)).toBe("backward");
    }
  });
});
