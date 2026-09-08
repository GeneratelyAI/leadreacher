"use client";

import { VideoStyleSelection } from "./PersonalizedVideoStyle";
import type { VideoTone } from "./video-style-types";

export default function AiVideoStyle({ preview = false, placeholderPreview = false, initialStyle }: { preview?: boolean; placeholderPreview?: boolean; initialStyle?: VideoTone }) {
  return <VideoStyleSelection mode="standardized" styleLabel="AI video style" preview={preview} placeholderPreview={placeholderPreview} initialStyle={initialStyle} />;
}
