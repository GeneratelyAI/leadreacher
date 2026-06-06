export const ANIMATION_FPS = 24;
export const ANIMATION_TOTAL_FRAMES = 144;
export const ANIMATION_BOUNCE_LOOP_START_INDEX = 115; // frame 116 (1-based)

export const ANIMATION_FRAME_PATHS = Array.from(
  { length: ANIMATION_TOTAL_FRAMES },
  (_, index) =>
    `/animation/anim_desktop_v6_${String(index + 1).padStart(4, "0")}.png`,
);
