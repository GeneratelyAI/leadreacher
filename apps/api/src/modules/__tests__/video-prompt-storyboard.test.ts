import { describe, expect, it } from "vitest";
import { VideoPromptOutputSchema } from "../agents/video-prompt-agent.js";
import { normalizeVideoPromptCriticOutput } from "../critics/video-prompt-critic.js";
import { buildPersonalizedVideoTemplatePromptMessage } from "../agents/personalized-video-prompt-agent.js";
import { normalizePersonalizedVideoTemplateCriticOutput } from "../critics/personalized-video-prompt-critic.js";

const storyboard = [
  {
    sceneNumber: 1,
    timeRange: "0-2s",
    beat: "hook",
    imagePrompt:
      "Tight macro shot of a founder watching a dashboard flood with disconnected data alerts, dramatic blue monitor glow, low-angle camera, premium cinematic texture.",
    motionNote: "A rapid push-in ends on the founder's concerned expression before a hard cut to the busy workspace.",
  },
  {
    sceneNumber: 2,
    timeRange: "2-4s",
    beat: "problem",
    imagePrompt:
      "Overhead view of a cluttered operations desk with scattered spreadsheets and ringing devices, cool desaturated lighting, precise editorial composition, visible time pressure.",
    motionNote: "The camera tilts down into one unresolved spreadsheet cell, which morphs into the product interface.",
  },
  {
    sceneNumber: 3,
    timeRange: "4-6s",
    beat: "solution",
    imagePrompt:
      "Medium over-the-shoulder shot of the same founder using a clean unified analytics workspace, warm key light, elegant interface glow, confident focused posture.",
    motionNote: "A smooth lateral slide follows the interface resolving into clear connected insights and transitions to the result.",
  },
  {
    sceneNumber: 4,
    timeRange: "6-8s, then branded hold 8-10s",
    beat: "payoff",
    imagePrompt:
      "Wide hero shot of the founder leaving a calm modern office while a minimal branded insight panel resolves behind them, golden evening light, polished aspirational composition.",
    motionNote: "The camera eases back into a final branded hold with a clear call-to-action and clean end frame.",
  },
] as const;

const validOutput = {
  storyboard,
  videoPrompt:
    "Open on the stress of fragmented data, cut into the operational bottleneck, then morph the unresolved work into a unified analytics workspace. Follow the founder's shift from concern to clarity and finish on a calm branded outcome that invites the audience to see their own workflow connected.",
  hookDescription: "Immediate visual tension from data alerts stopping the founder mid-task.",
  ctaDescription: "End on the calm outcome and invite viewers to connect their workflow today.",
};

describe("Video storyboard prompt schema", () => {
  it.each([3, 5])("rejects a storyboard with %i scenes", (sceneCount) => {
    expect(
      VideoPromptOutputSchema.safeParse({
        ...validOutput,
        storyboard:
          sceneCount === 3
            ? storyboard.slice(0, 3)
            : [...storyboard, storyboard[3]],
      }).success,
    ).toBe(false);
  });

  it("requires the four commercial beats in sequence", () => {
    expect(
      VideoPromptOutputSchema.safeParse({
        ...validOutput,
        storyboard: [
          storyboard[0],
          { ...storyboard[1], beat: "solution" },
          storyboard[2],
          storyboard[3],
        ],
      }).success,
    ).toBe(false);
  });
});

describe("Video storyboard critic scoring", () => {
  it("derives passed from score >= 7 regardless of a model-supplied flag", () => {
    expect(
      normalizeVideoPromptCriticOutput({
        score: 6,
        passed: true,
        feedback: ["Scenes need stronger transitions."],
      }).passed,
    ).toBe(false);
    expect(
      normalizeVideoPromptCriticOutput({
        score: 7,
        passed: false,
        feedback: [],
      }).passed,
    ).toBe(true);
  });
});

describe("Personalized video template prompt pipeline", () => {
  it("reserves a silent greeting slot and excludes lead-specific data", () => {
    const message = buildPersonalizedVideoTemplatePromptMessage({
      orgId: "org-1",
      templateId: "template-1",
      seedPrompt: "A concise outreach video.",
      product: "Stern Cohen Accountants",
      audience: "Finance leaders",
      tone: "professional",
      avatar: "professional spokesperson",
      setting: "a busy accounting firm",
      hasLogoReference: true,
    });

    expect(message).toContain("first 1.5 seconds must contain no spoken dialogue");
    expect(message).toContain("LOGO REFERENCE AVAILABLE: yes - the worker, not the model, overlays it exactly");
    expect(message).not.toContain("LEAD COMPANY:");
  });

  it("derives the personalized template critic pass state from its score", () => {
    expect(
      normalizePersonalizedVideoTemplateCriticOutput({ score: 6, feedback: ["The greeting slot is missing."] }).passed,
    ).toBe(false);
    expect(
      normalizePersonalizedVideoTemplateCriticOutput({ score: 8, feedback: [] }).passed,
    ).toBe(true);
  });
});
