import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/patterns/StatTable";
import { formatNumber } from "../state/analytics-format";
import type { AnalyticsResponse, CampaignRow } from "../state/analytics-model";
import { MiniBar } from "./MiniBar";
import { ChannelPerformanceTable } from "./ChannelPerformanceTable";

export function AnalyticsPerformance({ analytics }: { analytics: AnalyticsResponse }) {
  const maxChannelMeetings = useMemo(
    () => Math.max(0, ...(analytics?.channels.map((row) => row.meetingsBooked) ?? [0])),
    [analytics],
  );
  const maxCampaignMeetings = useMemo(
    () => Math.max(0, ...(analytics?.campaigns.map((row) => row.meetingsBooked) ?? [0])),
    [analytics],
  );

  const channelTotals = useMemo(() => {
    const rows = analytics?.channels ?? [];
    const messagesSent = rows.reduce((sum, row) => sum + row.messagesSent, 0);
    const replies = rows.reduce((sum, row) => sum + row.replies, 0);
    const meetingsBooked = rows.reduce((sum, row) => sum + row.meetingsBooked, 0);
    return {
      messagesSent,
      replies,
      replyRate: messagesSent === 0 ? 0 : Math.round((replies / messagesSent) * 1000) / 10,
      meetingsBooked,
    };
  }, [analytics]);

  const campaignColumns: DataTableColumn<CampaignRow>[] = [
    {
      key: "name",
      header: "Campaign",
      isLabel: true,
      className: "max-w-48 truncate",
      render: (row) => row.name,
    },
    { key: "messagesSent", header: "Messages sent", align: "right", render: (row) => formatNumber(row.messagesSent) },
    { key: "replies", header: "Replies", align: "right", render: (row) => formatNumber(row.replies) },
    { key: "replyRate", header: "Reply rate", align: "right", render: (row) => `${row.replyRate}%` },
    {
      key: "meetingsBooked",
      header: "Meetings booked",
      render: (row) => <MiniBar value={row.meetingsBooked} max={maxCampaignMeetings} tone="purple" />,
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Performance by channel</h2>
        </div>
        {analytics.channels.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">No delivery data in this range.</div>
        ) : (
          <ChannelPerformanceTable rows={analytics.channels} totals={channelTotals} maxMeetings={maxChannelMeetings} />
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Top campaigns</h2>
        </div>
        {analytics.campaigns.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">No campaign activity in this range.</div>
        ) : (
          <>
            <DataTable
              columns={campaignColumns}
              data={analytics.campaigns}
              getRowKey={(row) => row.id}
            />
            <div className="border-t border-border px-5 py-3">
              <Link
                href="/dashboard/campaigns"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 dark:text-onboarding-purple-200"
              >
                View all campaigns <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
