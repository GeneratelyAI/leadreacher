type JsonRecord = Record<string, unknown>;

export type VideoPromptBriefStrategy = {
  positioning?: unknown;
  icpDefinition?: unknown;
  messagingAngles?: unknown;
  creativeAssets?: unknown;
  contentApproach?: unknown;
  expectedOutcome?: unknown;
  videoConfig?: unknown;
  logoUrl?: string | null;
};

export type VideoPromptBriefInput = {
  campaignName: string;
  strategy: VideoPromptBriefStrategy | null;
  product: string;
  audience: string;
  tone: string;
  avatar: string;
  setting: string;
  hasLogoReference: boolean;
  logoUrl?: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function recordString(record: JsonRecord | null, key: string): string | undefined {
  return record ? stringValue(record[key]) : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = stringValue(value);
    if (result) return result;
  }
  return undefined;
}

function clip(value: string, maxLength = 900): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function strategyBrief(input: VideoPromptBriefInput): {
  valueProposition: string;
  outreachMessage: string;
  creativeBrief: string;
  narration: string;
  transition: string;
  logoInstruction: string;
} {
  const strategy = input.strategy;
  const positioning = asRecord(strategy?.positioning);
  const messagingAngles = asRecord(strategy?.messagingAngles);
  const creativeAssets = asRecord(strategy?.creativeAssets);
  const contentApproach = asRecord(strategy?.contentApproach);
  const expectedOutcome = asRecord(strategy?.expectedOutcome);
  const videoConfig = asRecord(strategy?.videoConfig);

  const valueProposition =
    firstString(
      recordString(positioning, "valueProposition"),
      recordString(positioning, "differentiator"),
      recordString(positioning, "strengths"),
      recordString(messagingAngles, "valueProposition"),
      recordString(contentApproach, "valueProposition"),
      input.product,
    ) ?? "Use the supplied product or service description without adding unsupported claims.";

  const outreachMessage =
    recordString(messagingAngles, "outreachMessage") ??
    "No approved outreach message is stored. Derive the pitch from the strategy facts above without using lead placeholders in shared narration.";

  const creativeBrief =
    firstString(
      recordString(creativeAssets, "creativeBrief"),
      recordString(creativeAssets, "videoBrief"),
      recordString(contentApproach, "creativeBrief"),
      recordString(contentApproach, "videoBrief"),
    ) ??
    "Create a credible B2B commercial that makes the product value easy to understand for the target audience.";

  const narration =
    firstString(
      recordString(videoConfig, "sharedNarration"),
      recordString(videoConfig, "narrationScript"),
      recordString(creativeAssets, "sharedNarration"),
      recordString(creativeAssets, "narrationScript"),
      recordString(contentApproach, "videoNarration"),
      recordString(contentApproach, "narrationScript"),
      recordString(expectedOutcome, "narration"),
    ) ??
    "Write a concise spoken pitch from the product, audience, and value proposition above. State the value plainly, avoid invented statistics, and keep the wording within the available timing.";

  const transition =
    firstString(
      recordString(videoConfig, "transitionDirection"),
      recordString(videoConfig, "transition"),
      recordString(creativeAssets, "transitionDirection"),
      recordString(creativeAssets, "transition"),
      recordString(contentApproach, "transitionDirection"),
    ) ??
    "Use a smooth camera pan or motivated visual transition from the spokesperson into a strategy-relevant business scene, then resolve cleanly into the supplied logo.";

  const logoUrl = firstString(input.logoUrl, strategy?.logoUrl, recordString(creativeAssets, "logoUrl"));
  const logoInstruction = input.hasLogoReference && logoUrl
    ? `Use the supplied logo reference (${clip(logoUrl, 300)}) for the final end card. Preserve its shape, colors, and proportions; do not add any other end-card text, numbers, metrics, or claims.`
    : "No logo reference is available. Do not invent a logo or add written end-card text.";

  return {
    valueProposition: clip(valueProposition),
    outreachMessage: clip(outreachMessage),
    creativeBrief: clip(creativeBrief),
    narration: clip(narration),
    transition: clip(transition),
    logoInstruction,
  };
}

function sharedContext(input: VideoPromptBriefInput, brief: ReturnType<typeof strategyBrief>): string {
  return `CAMPAIGN: ${input.campaignName}
PRODUCT / BUSINESS: ${input.product}
TARGET AUDIENCE: ${input.audience}
VALUE PROPOSITION: ${brief.valueProposition}
CAMPAIGN MESSAGE ANGLE: ${brief.outreachMessage}
TONE: ${input.tone}
SPOKESPERSON: ${input.avatar}
SETTING: ${input.setting}
CREATIVE BRIEF: ${brief.creativeBrief}
NARRATION SCRIPT OR DIRECTION: ${brief.narration}
TRANSITION DIRECTION: ${brief.transition}
LOGO INSTRUCTION: ${brief.logoInstruction}`;
}

export function buildPersonalizedVideoSeedPrompt(input: VideoPromptBriefInput): string {
  const brief = strategyBrief(input);

  return `Create a polished, professional ten-second personalized spokesperson advertisement for this campaign.

${sharedContext(input, brief)}

PERSONALIZED VIDEO STRUCTURE:
1. IMAGE: using the supplied company logo as the brand reference, create an attractive, credible professional spokesperson filming an advertisement in a busy, authentic setting relevant to the advertiser and industry. Maintain the logo's exact visual integrity. Add no additional logos, written copy, captions, numbers, graphics, or unrelated images.
2. 0-1.5s: hold on the spokesperson looking directly into the camera. Use a natural silent acknowledgment with a closed or minimally moving mouth. Leave this exact slot for a lead-specific TTS greeting added later, such as "Hey {firstName},". Do not include that greeting in the shared narration or show it as text.
3. 1.5-8s: animate a natural professional performance aligned with the shared campaign pitch. Keep the spokesperson, setting, lighting, and visual style consistent.
4. Within the pitch, around 6.5-8.5s: use a smooth camera pan or transition into a visually relevant scene based on the advertiser, industry, and message. The transition may overlap the end of the narration.
5. 8.5-10s: transition into the supplied company logo and preserve it exactly as provided.

Generate exactly ten seconds. Add no generated speech, dialogue, narration, music, captions, subtitles, additional copy, data, numbers, statistics, extra logos, or invented branding. Audio is added separately. Return the required four-scene storyboard, visual-only direction, and shared narration while preserving this structure.`;
}

export function buildStandardVideoSeedPrompt(input: VideoPromptBriefInput): string {
  const brief = strategyBrief(input);

  return `Create a standardized ten-second AI campaign video for the entire audience of this campaign.

${sharedContext(input, brief)}

STANDARD VIDEO STRATEGY:
1. 0-2s: open with a clear, audience-relevant hook using the spokesperson and setting. This is one shared campaign video, so do not mention a lead, first name, company name, or personal profile.
2. 2-4s: visualize the business problem or context described by the strategy.
3. 4-6s: show the product or service as the credible solution and follow the supplied narration direction.
4. 6-8s: use the transition direction to move into the brand payoff.
5. 8-10s: hold a clean final logo frame when a logo reference exists. Follow the logo instruction and never add unsupported claims or visual data.

Use the strategy above as the source of truth for the creative brief, narration, transition, audience, tone, and brand treatment. Do not personalize this video and do not add a lead-specific greeting.`;
}
