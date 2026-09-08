"use client";

import { VideoStyleSelection } from "./PersonalizedVideoStyle";

export default function AiVideoStyle({ preview = false }: { preview?: boolean }) {
  return <VideoStyleSelection mode="standardized" styleLabel="AI video style" preview={preview} />;
}
