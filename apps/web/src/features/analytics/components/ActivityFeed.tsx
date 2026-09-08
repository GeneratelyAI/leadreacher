import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatSocialMediaNames } from "@/features/channels/public/Channel";
import { relativeTime } from "../state/activity-format";
import type { DayGroup } from "../state/activity-model";
import { ActivityMark } from "./ActivityMark";

export function ActivityFeed({ dayGroups }: { dayGroups: DayGroup[] }) {
  return (
    <div>
      {dayGroups.map((group, groupIndex) => (
        <section key={group.key} aria-labelledby={`activity-day-${group.key}`}>
          {groupIndex > 0 ? (
            <div className="border-t border-border bg-muted/30 px-4 py-2 sm:px-5">
              <h3 id={`activity-day-${group.key}`} className="text-sm font-semibold">
                {group.label}
              </h3>
            </div>
          ) : (
            <h3 id={`activity-day-${group.key}`} className="sr-only">
              {group.label}
            </h3>
          )}
          <ul className="divide-y divide-border">
            {group.items.map((item) => {
              const href = item.href ?? "/dashboard/activity";
              const actionLabel = item.action === "reply" ? "Reply" : "View";
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <ActivityMark item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                        {formatSocialMediaNames(item.title)}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                        {formatSocialMediaNames(item.detail)}
                      </p>
                    </div>
                    <time
                      dateTime={item.occurredAt}
                      className="hidden shrink-0 text-xs text-onboarding-neutral-500 sm:block dark:text-onboarding-neutral-400"
                    >
                      {relativeTime(item.occurredAt)}
                    </time>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={href}>{actionLabel}</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
