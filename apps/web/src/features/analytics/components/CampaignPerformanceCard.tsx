import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "../state/analytics-format";
import type { AnalyticsResponse } from "../state/overview-model";

export function CampaignPerformanceCard({ analytics }: { analytics: AnalyticsResponse | null }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4"><CardTitle>Campaign performance</CardTitle><Link href="/dashboard/campaigns" className="text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View campaigns</Link></CardHeader>
      {analytics?.campaigns.length ? <div className="flex-1 overflow-x-auto [&>[data-slot=table-container]]:h-full"><Table className="h-full"><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Replies</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader><TableBody>{analytics.campaigns.slice(0, 5).map((row) => <TableRow key={row.id}><TableCell className="max-w-52 truncate font-medium">{row.name}</TableCell><TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell></TableRow>)}</TableBody></Table></div> : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Campaign performance appears after outreach is sent.</div>}
    </Card>
  );
}
