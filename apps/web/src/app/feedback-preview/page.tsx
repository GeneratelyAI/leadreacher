"use client";

import { FeedbackCard, FeedbackPreviewStack, type FeedbackOptions } from "@/components/ui/feedback";

const examples: FeedbackOptions[] = [
  {
    tone: "error",
    title: "Message could not be sent",
    description: "This LinkedIn recipient cannot receive messages.",
    action: { label: "Choose another channel", onClick: () => undefined },
  },
  {
    tone: "success",
    title: "Campaign saved",
    description: "Your changes are ready for review.",
    action: { label: "View campaign", onClick: () => undefined },
  },
  {
    tone: "guidance",
    title: "Connect LinkedIn to continue",
    description: "Your first campaign needs one active sender account.",
    action: { label: "Connect LinkedIn", onClick: () => undefined },
    secondaryAction: { label: "Why is this needed?", onClick: () => undefined },
  },
  {
    tone: "warning",
    title: "Two prospects need review",
    description: "You can continue after approving or removing them.",
    action: { label: "Review prospects", onClick: () => undefined },
  },
  {
    tone: "loading",
    title: "Preparing personalized videos",
    description: "12 of 24 videos are ready. You can leave this page.",
  },
];

export default function FeedbackPreviewPage() {
  return (
    <main className="min-h-dvh bg-[#f7f6fb] px-6 py-12 text-[#111527] dark:bg-[#0a0e14] dark:text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5a32ed] dark:text-[#a994ff]">LeadReacher feedback center</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Clear feedback, in one consistent place.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#62697e] dark:text-[#a9adbc]">Five semantic states use the same structure, placement, actions, and accessible announcements.</p>
        <div className="mt-10 flex justify-end">
          <FeedbackPreviewStack>
            {examples.map((example) => <FeedbackCard key={example.tone} options={example} preview />)}
          </FeedbackPreviewStack>
        </div>
      </div>
    </main>
  );
}
