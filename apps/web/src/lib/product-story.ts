export const PRODUCT_STORY_STAGE_IDS = [
  "website",
  "strategy",
  "prospects",
  "outreach",
  "conversations",
] as const;

export type ProductStoryStageId = (typeof PRODUCT_STORY_STAGE_IDS)[number];

const STORY_START = 0.18;
const STORY_END = 0.88;

export function stageIndexForProgress(progress: number): number {
  const clamped = Math.min(Math.max(progress, STORY_START), STORY_END);
  const normalized = (clamped - STORY_START) / (STORY_END - STORY_START);
  return Math.min(
    PRODUCT_STORY_STAGE_IDS.length - 1,
    Math.floor(normalized * PRODUCT_STORY_STAGE_IDS.length),
  );
}

export function progressForStageIndex(index: number): number {
  const safeIndex = Math.min(
    Math.max(Math.trunc(index), 0),
    PRODUCT_STORY_STAGE_IDS.length - 1,
  );
  const segment = (STORY_END - STORY_START) / PRODUCT_STORY_STAGE_IDS.length;
  return STORY_START + segment * (safeIndex + 0.5);
}
