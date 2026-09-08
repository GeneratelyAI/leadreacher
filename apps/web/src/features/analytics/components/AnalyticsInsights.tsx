import type { ReactNode } from "react";
import { Loader2 } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/Card";
import { formatSocialMediaNames } from "@/features/channels/public/Channel";
import type { AnalyticsInsights as InsightData } from "../state/analytics-model";

function InsightPanel({ title, items, empty }: { title: string; items: ReactNode[]; empty: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={index} className="px-5 py-4">
              {item}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


export function AnalyticsInsights({ insights }: { insights: InsightData | null }) {
  return (
    <section aria-labelledby="analytics-insights-heading" className="space-y-3">
      <div>
        <h2 id="analytics-insights-heading" className="text-xl font-semibold">Insights</h2>
        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Narrated only from recorded outreach performance.
        </p>
      </div>
      {insights?.status === "no_data" ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Once you have sent some outreach, insights will appear here.
          </CardContent>
        </Card>
      ) : insights?.status === "aggregating" || !insights ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Still gathering data
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          <InsightPanel
            title="What’s working"
            empty="No positive patterns are available from the recorded data yet."
            items={insights.whatsWorking.map((item) => (
              <div key={`${item.campaignId}:${item.text}`}>
                <p className="text-sm leading-6">{item.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatSocialMediaNames(item.campaignName)}</p>
              </div>
            ))}
          />
          <InsightPanel
            title="What’s not working"
            empty="No underperforming pattern is available from the recorded data yet."
            items={insights.whatsNotWorking.map((item) => (
              <div key={`${item.campaignId}:${item.text}`}>
                <p className="text-sm leading-6">{item.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatSocialMediaNames(item.campaignName)}</p>
              </div>
            ))}
          />
          <InsightPanel
            title="What to do next"
            empty="No next action is available from the recorded data yet."
            items={insights.whatToDoNext.map((item) => (
              <div key={`${item.campaignId}:${item.action}`}>
                <p className="text-sm font-medium leading-6">{item.action}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Priority {item.priority} · {formatSocialMediaNames(item.campaignName)}
                </p>
              </div>
            ))}
          />
        </div>
      )}
    </section>
  );
}
