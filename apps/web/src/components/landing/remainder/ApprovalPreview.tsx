"use client";

import Link from "next/link";
import { useRef, useState, type RefObject } from "react";
import { ArrowRight, Pause, Play } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { approvalTabs, type ApprovalTab } from "./content";

type ApprovalPreviewProps = {
  activeTab: ApprovalTab;
  onTabChange: (tab: ApprovalTab) => void;
  videoTargetRef?: RefObject<HTMLDivElement | null>;
  videoSrc: string;
  videoPoster?: string;
};

export function ApprovalPreview({ activeTab, onTabChange, videoTargetRef, videoSrc, videoPoster }: ApprovalPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(
    "I noticed your team is focused on making growth execution more consistent.\n\nWe prepared a short idea showing how outreach could stay coordinated without adding another manual workflow.\n\nWould it be useful to compare notes?",
  );

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#dcd8e9] bg-[#f9f8fd] shadow-[0_30px_80px_rgba(42,28,104,0.16)]">
      <div role="tablist" aria-label="Outreach preview type" className="grid grid-cols-4 border-b border-[#dfdbe9] bg-white px-2 sm:px-5">
        {approvalTabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`approval-panel-${tab.toLowerCase()}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => onTabChange(tab)} className={cn("relative h-12 rounded-sm text-xs font-medium text-[#6c7284] transition-colors hover:text-[#292f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b7fd4] sm:text-sm", activeTab === tab && "text-[#4e28df]")}>{tab}{activeTab === tab ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#4e28df]" /> : null}</button>)}
      </div>
      <div id={`approval-panel-${activeTab.toLowerCase()}`} role="tabpanel" aria-label={`${activeTab} outreach preview`} className="grid min-h-[360px] gap-5 p-4 min-[360px]:p-5 md:grid-cols-[0.9fr_1.1fr] md:p-7">
        <div className="rounded-lg border border-[#e1deeb] bg-white p-5">
          <p className="text-sm font-semibold text-[#4e28df]">Hi Sarah,</p>
          {isEditing ? (
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-label="Edit personalized outreach message"
              className="mt-4 min-h-52 w-full resize-none rounded-lg border border-[#d9d5e5] bg-[#fbfaff] p-3 text-base leading-6 text-[#444a5d] outline-none focus:border-[#8b7fd4] focus:ring-3 focus:ring-[#8b7fd4]/20"
            />
          ) : (
            <div className="mt-4 whitespace-pre-line text-sm leading-6 text-[#444a5d]">{message}</div>
          )}
          <p className="mt-5 text-sm text-[#444a5d]">Best,<br />Alex</p>
        </div>
        <div className="flex flex-col">
          <div ref={videoTargetRef} data-testid="campaign-video-preview" className="relative flex min-h-56 flex-1 items-center justify-center overflow-hidden rounded-lg bg-[#121426]">
            <video ref={videoRef} suppressHydrationWarning autoPlay muted loop playsInline preload="metadata" poster={videoPoster} aria-label="Personalized video preview" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} className="absolute inset-0 size-full object-cover object-center"><source src={videoSrc} type="video/mp4" /></video>
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,21,.1),rgba(8,10,21,.5))]" />
            <div className="relative text-center text-white"><button type="button" onClick={toggleVideo} aria-label={isPlaying ? "Pause personalized video preview" : "Play personalized video preview"} className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/70">{isPlaying ? <Pause className="size-6 fill-white" aria-hidden /> : <Play className="ml-1 size-6 fill-white" aria-hidden />}</button><p className="mt-4 text-sm font-medium">Personalized video preview</p><p className="mt-1 text-xs text-white/55">Review before launch</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 min-[360px]:gap-3"><button type="button" aria-pressed={isEditing} onClick={() => setIsEditing((value) => !value)} className="min-h-11 rounded-lg border border-[#d9d5e5] bg-white px-2 text-sm font-semibold text-[#4b5163] transition-colors hover:bg-[#f5f3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4]">{isEditing ? "Done" : "Edit"}</button><Link href="/signup" className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-[#4e28df] px-2 text-center text-xs font-semibold text-white transition-colors hover:bg-[#4020c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4] min-[360px]:gap-2 min-[360px]:text-sm">Approve and send <ArrowRight className="size-4 shrink-0" /></Link></div>
        </div>
      </div>
    </div>
  );
}
