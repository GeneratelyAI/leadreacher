export const SILENT_VISUAL_VIDEO_CONSTRAINT = `Generate a silent visual-only video. Do not add speech, dialogue, narration, music, sound effects, captions, subtitles, text, numbers, or metrics. The application adds audio separately after video generation.`;

export function withSilentVisualConstraint(prompt: string): string {
  return `${prompt.trim()}\n\n${SILENT_VISUAL_VIDEO_CONSTRAINT}`;
}
