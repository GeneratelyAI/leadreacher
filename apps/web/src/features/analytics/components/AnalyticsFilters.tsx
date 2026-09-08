import { CalendarDays, Send } from "@/components/ui/icons";
import { Filter, MultiFilter, type FilterGroup } from "@/components/patterns/Filter";
import { channelDisplayName, formatSocialMediaNames, PlatformLogo } from "@/features/channels/public/Channel";
import type { useAnalytics } from "../hooks/useAnalytics";

type Props = Pick<ReturnType<typeof useAnalytics>, "analytics" | "isRefreshing" | "campaignFilter" | "selectedChannels" | "granularity" | "setGranularity" | "setSelectedChannels" | "setCampaignFilterAndUrl">;

export function AnalyticsFilters({ analytics, isRefreshing, campaignFilter, selectedChannels, granularity, setGranularity, setSelectedChannels, setCampaignFilterAndUrl }: Props) {
  const campaignFilterGroups: FilterGroup[] = (analytics?.filters.campaigns ?? []).length
    ? [{
      label: "Campaigns",
      options: (analytics?.filters.campaigns ?? []).map((campaign) => ({
        value: campaign.id,
        label: formatSocialMediaNames(campaign.name),
      })),
    }]
    : [];
  const channelFilterGroups: FilterGroup[] = (analytics?.filters.channels ?? []).length
    ? [{
      label: "Channels",
      options: (analytics?.filters.channels ?? []).map((channel) => ({
        value: channel,
        label: channelDisplayName(channel),
        icon: <PlatformLogo platform={channel} className="size-6" />,
      })),
    }]
    : [];

  return (
    <div className="flex flex-wrap items-end gap-3">
      {isRefreshing ? <span className="text-xs text-muted-foreground" aria-live="polite">Updating analytics…</span> : null}
      <div className="flex min-w-44 flex-col gap-1.5">
        <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Campaign
        </span>
        <Filter
          value={campaignFilter}
          groups={campaignFilterGroups}
          onValueChange={setCampaignFilterAndUrl}
          allLabel="All campaigns"
          allIcon={<Send className="size-5" aria-hidden />}
          className="h-9 min-w-44 text-sm font-normal"
          aria-label="Filter analytics by campaign"
        />
      </div>

      <div className="flex min-w-40 flex-col gap-1.5">
        <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Channels
        </span>
        <MultiFilter
          groups={channelFilterGroups}
          value={selectedChannels}
          onValueChange={setSelectedChannels}
          allLabel="All channels"
          allIcon={<PlatformLogo platform="linkedin" className="size-5" />}
          className="h-9 min-w-40 text-sm font-normal"
          aria-label="Filter analytics by channels"
        />
      </div>

      <div className="flex min-w-36 flex-col gap-1.5">
        <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Time duration
        </span>
        <Filter
          value={granularity}
          groups={[{ label: "Time duration", options: [
            { value: "day", label: "Daily", icon: <CalendarDays className="size-5" /> },
            { value: "week", label: "Weekly", icon: <CalendarDays className="size-5" /> },
          ] }]}
          onValueChange={(value) => setGranularity(value as "day" | "week")}
          allLabel="Daily"
          showAll={false}
          className="h-9 min-w-36 text-sm font-normal"
          aria-label="Chart time duration"
        />
      </div>
    </div>
  );
}
