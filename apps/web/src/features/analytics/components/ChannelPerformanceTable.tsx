import { useMemo } from "react";
import { ChevronDown } from "@/components/ui/icons";
import { channelDisplayName, PlatformLogo, groupEmailChannelMetrics } from "@/features/channels/public/Channel";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";
import type { ChannelRow } from "../state/analytics-model";
import { MiniBar } from "./MiniBar";

export function ChannelPerformanceTable({ rows, totals, maxMeetings }: { rows: ChannelRow[]; totals: Omit<ChannelRow, "channel">; maxMeetings: number }) {
  const grouped = useMemo(() => groupEmailChannelMetrics(rows), [rows]);
  return (
    <>
      <div className="hidden flex-1 overflow-x-auto lg:block lg:[&>[data-slot=table-container]]:h-full">
        <Table className="h-full">
          <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Messages sent</TableHead><TableHead className="text-right">Replies</TableHead><TableHead className="text-right">Reply rate</TableHead><TableHead>Meetings booked</TableHead></TableRow></TableHeader>
          {grouped.rows.map((row) => {
            const expandable = row.channel === "email" && grouped.emailProviders.length > 0;
            return (
              <TableBody key={row.channel} className={cn(expandable && "group/email")}>
                <TableRow tabIndex={expandable ? 0 : undefined} className={cn(expandable && "cursor-default focus-visible:bg-muted/50 focus-visible:outline-none")}>
                  <TableCell><span className="flex items-center gap-2 font-medium"><PlatformLogo platform={row.channel} className="size-8" />{channelDisplayName(row.channel)}{expandable ? <ChevronDown className="ml-1 size-3.5 text-muted-foreground transition-transform duration-300 group-hover/email:rotate-180 group-focus-within/email:rotate-180" aria-hidden /> : null}</span></TableCell>
                  <TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell><TableCell><MiniBar value={row.meetingsBooked} max={maxMeetings} tone="green" /></TableCell>
                </TableRow>
                {expandable ? (
                  <TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={5} className="p-0"><div className="max-h-0 overflow-hidden bg-muted/20 opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/email:max-h-32 group-hover/email:opacity-100 group-focus-within/email:max-h-32 group-focus-within/email:opacity-100">{grouped.emailProviders.map((provider) => <div key={provider.channel} className="grid grid-cols-[minmax(10rem,1fr)_7rem_5rem_6rem_minmax(8rem,1fr)] items-center border-t border-app-border px-2 py-2 text-sm"><span className="flex items-center gap-2 pl-5 font-medium"><PlatformLogo platform={provider.channel} className="size-6" />{channelDisplayName(provider.channel)}</span><span className="text-right">{formatNumber(provider.messagesSent)}</span><span className="text-right">{formatNumber(provider.replies)}</span><span className="text-right">{provider.replyRate}%</span><MiniBar value={provider.meetingsBooked} max={maxMeetings} tone="green" /></div>)}</div></TableCell></TableRow>
                ) : null}
              </TableBody>
            );
          })}
          <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right">{formatNumber(totals.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(totals.replies)}</TableCell><TableCell className="text-right">{totals.replyRate}%</TableCell><TableCell><MiniBar value={totals.meetingsBooked} max={maxMeetings} tone="green" /></TableCell></TableRow></TableFooter>
        </Table>
      </div>
      <ul className="divide-y divide-border lg:hidden">{grouped.rows.map((row) => <li key={row.channel} className="px-4 py-3.5"><div className="flex items-center gap-2 font-medium"><PlatformLogo platform={row.channel} />{channelDisplayName(row.channel)}</div><dl className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Sent</dt><dd>{formatNumber(row.messagesSent)}</dd></div><div><dt className="text-muted-foreground">Replies</dt><dd>{formatNumber(row.replies)}</dd></div><div><dt className="text-muted-foreground">Reply rate</dt><dd>{row.replyRate}%</dd></div><div><dt className="text-muted-foreground">Meetings</dt><dd>{formatNumber(row.meetingsBooked)}</dd></div></dl>{row.channel === "email" ? <div className="mt-3 grid grid-cols-2 gap-2">{grouped.emailProviders.map((provider) => <div key={provider.channel} className="rounded-md bg-muted/40 p-2 text-xs"><span className="flex items-center gap-1.5 font-medium"><PlatformLogo platform={provider.channel} className="size-4" />{channelDisplayName(provider.channel)}</span><span className="mt-1 block text-muted-foreground">{provider.messagesSent} sent · {provider.replies} replies</span></div>)}</div> : null}</li>)}</ul>
    </>
  );
}
