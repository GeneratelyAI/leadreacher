"use client";

import { ChevronLeft, ChevronRight, MessageSquare } from "@/components/ui/icons";
import { channelDisplayName, PlatformLogo, formatSocialMediaNames } from "@/features/channels/public/Channel";
import { Filter, type FilterGroup } from "@/components/patterns/Filter";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useActivity } from "../hooks/useActivity";
import { KIND_TABS, PAGE_SIZE, type ActivityTab } from "../state/activity-model";
import { ActivityKpis } from "../components/ActivityKpis";
import { ActivityFeed } from "../components/ActivityFeed";

export function Activity() {
  const { activity, total, summary, campaigns, channels, isLoading, isRefreshing, error, pageCount, dayGroups, kind, setKind, page, setPage, channelFilter, campaignFilter, setVisualFilter } = useActivity();

  const selectedFilter = campaignFilter ? `campaign:${campaignFilter}` : channelFilter ? `channel:${channelFilter}` : "";
  const filterGroups: FilterGroup[] = [
    {
      label: "Channels",
      options: channels.map((channel) => ({
        value: `channel:${channel}`,
        label: channelDisplayName(channel),
        icon: <PlatformLogo platform={channel} className="size-6" />,
      })),
    },
    {
      label: "Campaigns",
      options: campaigns.map((campaign) => ({
        value: `campaign:${campaign.id}`,
        label: formatSocialMediaNames(campaign.name),
      })),
    },
  ].filter((group) => group.options.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
            <span className="size-2 rounded-full bg-onboarding-success-500" aria-hidden />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            A live feed of outreach, replies, prospect changes, and campaign events across your workspace.
          </p>
        </div>

        <Tabs value={kind} onValueChange={(value) => setKind(value as ActivityTab)}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {KIND_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-onboarding-purple-50 data-[state=active]:text-onboarding-purple-700 data-[state=active]:shadow-none",
                  "dark:data-[state=active]:bg-onboarding-purple-900 dark:data-[state=active]:text-onboarding-purple-100",
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <ActivityKpis summary={summary} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{dayGroups[0]?.label ?? "Activity"}</h2>{isRefreshing ? <span className="text-xs text-muted-foreground">Updating…</span> : null}</div>
          <Filter
            value={selectedFilter}
            groups={filterGroups}
            onValueChange={setVisualFilter}
            allLabel="All activity"
            aria-label="Filter activity"
          />
        </div>

        {isLoading ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-sm text-muted-foreground">
            <Loading tone="brand" label="Loading activity" className="-mb-4" />
            <span>Loading activity</span>
          </div>
        ) : activity.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageSquare className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No activity yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Activity will appear after prospects are added, campaigns are updated, or outreach begins.
            </p>
          </div>
        ) : (
          <ActivityFeed dayGroups={dayGroups} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <span>
            Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of{" "}
            {total.toLocaleString()} activities
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 font-medium text-foreground">
              {page}/{pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
