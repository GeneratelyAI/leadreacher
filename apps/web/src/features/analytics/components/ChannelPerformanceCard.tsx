import Link from "next/link";
import { useMemo } from "react";
import { ArrowUp, ChevronDown } from "@/components/ui/icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { channelDisplayName, PlatformLogo, groupEmailChannelMetrics } from "@/features/channels/public/Channel";
import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";
import type { AnalyticsResponse } from "../state/overview-model";

export function ChannelPerformanceCard({ analytics }: { analytics: AnalyticsResponse | null }) {
  const totals = useMemo(() => {
    const messagesSent = analytics?.channels.reduce((sum, row) => sum + row.messagesSent, 0) ?? 0;
    const replies = analytics?.channels.reduce((sum, row) => sum + row.replies, 0) ?? 0;
    return { messagesSent, replies, replyRate: messagesSent ? Math.round((replies / messagesSent) * 1000) / 10 : 0 };
  }, [analytics]);
  const channelRows = useMemo(() => {
    return groupEmailChannelMetrics(analytics?.channels ?? []);
  }, [analytics]);
  const best = channelRows.rows.filter((row) => row.messagesSent > 0).sort((a, b) => b.replyRate - a.replyRate)[0];
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4"><CardTitle>Channel performance</CardTitle><Link href="/dashboard/analytics" className="text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View report</Link></CardHeader>
      {analytics?.channels.length ? (
        <>
          <div className="flex-1 overflow-x-auto">
            <Table className="h-full">
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Reply rate</TableHead><TableHead className="text-right">Replies</TableHead></TableRow></TableHeader>
              {channelRows.rows.map((row) => {
                const expandable = row.channel === "email" && channelRows.emailProviders.length > 0;
                return (
                  <TableBody key={row.channel} className={cn(expandable && "group/email")}>
                    <TableRow tabIndex={expandable ? 0 : undefined} className={cn(expandable && "cursor-default focus-visible:bg-muted/50 focus-visible:outline-none")}>
                      <TableCell><span className="flex items-center gap-2 font-medium"><PlatformLogo platform={row.channel} className="size-6" />{channelDisplayName(row.channel)}{expandable ? <ChevronDown className="ml-1 size-3.5 text-muted-foreground transition-transform duration-300 group-hover/email:rotate-180 group-focus-within/email:rotate-180" aria-hidden /> : null}</span></TableCell>
                      <TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell>
                    </TableRow>
                    {expandable ? (
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={4} className="p-0">
                          <div className="max-h-0 overflow-hidden bg-muted/20 opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/email:max-h-28 group-hover/email:opacity-100 group-focus-within/email:max-h-28 group-focus-within/email:opacity-100">
                            {channelRows.emailProviders.map((provider) => (
                              <div key={provider.channel} className="grid grid-cols-[minmax(10rem,1fr)_4rem_5rem_4rem] items-center border-t border-app-border px-2 py-2 text-sm">
                                <span className="flex items-center gap-2 pl-5 font-medium"><PlatformLogo platform={provider.channel} className="size-5" />{channelDisplayName(provider.channel)}</span>
                                <span className="text-right">{formatNumber(provider.messagesSent)}</span><span className="text-right">{provider.replyRate}%</span><span className="text-right">{formatNumber(provider.replies)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                );
              })}
              <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right">{formatNumber(totals.messagesSent)}</TableCell><TableCell className="text-right">{totals.replyRate}%</TableCell><TableCell className="text-right">{formatNumber(totals.replies)}</TableCell></TableRow></TableFooter>
            </Table>
          </div>
          {best ? <div className="mx-4 mb-4 flex items-center gap-3 rounded-lg bg-onboarding-purple-50 px-3 py-2.5 text-xs dark:bg-onboarding-purple-900/40"><ArrowUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" /><span><strong>{channelDisplayName(best.channel)}</strong> has the highest recorded reply rate.</span></div> : null}
        </>
      ) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Channel performance appears after outreach is sent.</div>}
    </Card>
  );
}
