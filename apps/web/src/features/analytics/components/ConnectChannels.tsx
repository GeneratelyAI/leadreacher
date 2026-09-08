import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/Card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChannelLogo } from "@/platform/branding/ChannelLogo";
import type { DashboardOverview } from "../state/overview-model";

const CONNECT_CHANNELS = [
  { id: "linkedin", label: "LinkedIn", detail: "Professional outreach and follow-up sequences.", image: "/dashboard/linkedin-logo.png" },
  { id: "whatsapp", label: "WhatsApp", detail: "Direct, mobile-first prospect conversations.", image: null },
  { id: "instagram", label: "Instagram", detail: "Professional outreach in social inboxes.", image: "/dashboard/instagram-logo.png" },
  { id: "gmail", label: "Gmail", detail: "Approved email outreach from Google inboxes.", image: "/dashboard/gmail-logo.png" },
  { id: "outlook", label: "Outlook", detail: "Approved email outreach from Microsoft inboxes.", image: "/dashboard/outlook-logo.png" },
] as const;

export function ConnectChannels({ overview }: { overview: DashboardOverview }) {
  const active = new Set(overview.channels.filter((channel) => channel.status === "active").map((channel) => channel.platform.toLowerCase()));
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-16 items-center gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Expand your reach</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Manage your channels and add more for future campaigns.</p>
          <Link href="/dashboard/channels" className="mt-1 inline-flex text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">
            View channels <ArrowRight className="ml-1 size-3" />
          </Link>
        </div>
        <div className="flex max-w-[58%] shrink-0 items-center gap-3 overflow-x-auto touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-none">
          {CONNECT_CHANNELS.map((channel) => {
            const isConnected = channel.id === "gmail" || channel.id === "outlook"
              ? ["email", "google", "microsoft", "outlook", "imap"].some((key) => active.has(key))
              : active.has(channel.id);
            const label = `${channel.label}${isConnected ? " connected" : " channel settings"}`;

            return (
              <Tooltip key={channel.id}>
                <TooltipTrigger
                  render={
                    <Link
                      href="/dashboard/channels"
                      aria-label={label}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
                    />
                  }
                >
                  {channel.image ? <Image src={channel.image} width={24} height={24} alt="" unoptimized className="size-6 object-contain" /> : <ChannelLogo name="whatsapp-mark" className="size-6" />}
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
