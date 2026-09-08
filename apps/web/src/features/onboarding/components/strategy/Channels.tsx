"use client";

import { Check } from "@/components/ui/icons";
import { ChannelLogo } from "@/platform/branding/ChannelLogo";
import { cn } from "@/lib/utils";
import { ScreenHeader } from "./Chrome";
import type { ChannelKey } from "../../state/strategy-model";
import type { ChannelRecommendation } from "../../state/channel-recommendations";

function channelIcon(channel: ChannelKey): React.ReactNode {
  if (channel === "linkedin") {
    return <ChannelLogo name="linkedin" className="size-18" />;
  }
  if (channel === "whatsapp") {
    return <ChannelLogo name="whatsapp-mark" className="size-18" />;
  }
  if (channel === "instagram") {
    return <ChannelLogo name="instagram" className="size-16" />;
  }
  if (channel === "facebook") {
    return <ChannelLogo name="facebook" className="size-16" />;
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label="Gmail and Outlook">
      <ChannelLogo name="gmail" className="size-7.5" />
      <ChannelLogo name="outlook" className="size-7.5" />
    </span>
  );
}

export function ChannelsScreen({
  recommendations,
  selectedChannels,
  onToggle,
  isLoading,
  error,
}: {
  recommendations: ChannelRecommendation[];
  selectedChannels: ChannelKey[];
  onToggle: (channel: ChannelKey) => void;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Choose your channels"
          subtitle="Loading the channels available for your campaign."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Choose your channels"
          subtitle={error}
        />
      </section>
    );
  }

  const recommended = new Set(recommendations.slice(0, 2).map((item) => item.channel));
  const channels: Array<{ channel: ChannelKey; label: string; description: string }> = [
    { channel: "linkedin", label: "LinkedIn", description: "Reach professional decision-makers through your connected LinkedIn account." },
    { channel: "email", label: "Email", description: "Send approved email sequences through Gmail, Outlook, or another mailbox." },
    { channel: "whatsapp", label: "WhatsApp", description: "Start direct conversations with prospects who can be contacted on WhatsApp." },
    { channel: "instagram", label: "Instagram", description: "Reach prospects through approved Instagram direct messages." },
    { channel: "facebook", label: "Facebook Messenger", description: "Continue outreach through connected Messenger conversations." },
  ];
  const featured = channels.filter((item) => recommended.has(item.channel));
  const other = channels.filter((item) => !recommended.has(item.channel));

  const ChannelCard = ({ item, featuredCard = false }: { item: (typeof channels)[number]; featuredCard?: boolean }) => {
    const selected = selectedChannels.includes(item.channel);
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={item.channel === "linkedin"}
        onClick={() => onToggle(item.channel)}
        className={cn(
          "strategy-channel-card onboarding-accent-card group relative flex min-h-36 w-full items-start gap-4 rounded-3xl border bg-white p-5 text-left transition-[border-color,box-shadow,transform] duration-150 dark:bg-onboarding-neutral-900",
          selected
            ? "border-onboarding-purple-500 shadow-[0_14px_34px_rgba(91,43,224,0.12)] dark:border-onboarding-purple-300"
            : "border-onboarding-neutral-150 hover:border-onboarding-purple-200 hover:shadow-onboarding-small dark:border-onboarding-neutral-750",
          item.channel === "linkedin" ? "cursor-default" : "hover:-translate-y-0.5",
          featuredCard ? "strategy-channel-card--featured sm:min-h-40" : "",
        )}
      >
        <span className="inline-flex size-14 shrink-0 items-center justify-center [&>*]:max-h-full [&>*]:max-w-full" aria-hidden>{channelIcon(item.channel)}</span>
        <span className="min-w-0 pt-0.5 pr-7">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-onboarding-ink dark:text-white sm:text-xl">{item.label}</span>
            {item.channel === "linkedin" ? (
              <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-onboarding-purple-700 uppercase dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100">Required</span>
            ) : recommended.has(item.channel) ? (
              <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-onboarding-purple-700 uppercase dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100">Recommended</span>
            ) : null}
          </span>
          <span className="mt-2 block max-w-md text-sm leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.description}</span>
        </span>
        <span className={cn(
          "absolute top-5 right-5 grid size-7 place-items-center rounded-lg border transition-colors",
          selected ? "border-onboarding-purple-600 bg-onboarding-purple-600 text-white" : "border-onboarding-neutral-250 text-transparent dark:border-onboarding-neutral-650",
        )} aria-hidden>
          <Check className="size-4.5" />
        </span>
      </button>
    );
  };

  return (
    <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-start px-5 pt-28 pb-32 sm:pt-30 lg:pt-28">
      <ScreenHeader
        title="Choose your channels"
        subtitle="Select where LeadReacher can reach prospects. We’ll prioritize the channels that best fit your campaign."
        compact
      />

      <div className="mx-auto mt-6 w-full max-w-6xl">
        {featured.length > 0 ? (
          <div>
            <h2 className="text-base font-bold text-onboarding-ink dark:text-white">Recommended for this campaign</h2>
            <div className="strategy-channel-grid mt-3 grid gap-4 md:grid-cols-2">{featured.map((item) => <ChannelCard key={item.channel} item={item} featuredCard />)}</div>
          </div>
        ) : null}
        <div className={featured.length > 0 ? "mt-6" : ""}>
          <h2 className="text-base font-bold text-onboarding-ink dark:text-white">Other available channels</h2>
          <div className="strategy-channel-grid mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{other.map((item) => <ChannelCard key={item.channel} item={item} />)}</div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-onboarding-neutral-600 dark:text-onboarding-neutral-300">
          <span className="grid size-6 place-items-center rounded-full bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100" aria-hidden>
            <Check className="size-3.5" />
          </span>
          <p>{selectedChannels.length} {selectedChannels.length === 1 ? "channel" : "channels"} selected</p>
        </div>
      </div>
    </section>
  );
}
