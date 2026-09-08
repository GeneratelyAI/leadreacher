import { Skeleton } from "@/components/ui/skeleton";
import { Metrics } from "./Metrics";
import { AutomationStatusCard } from "./AutomationStatusCard";
import { AtAGlance } from "./AtAGlance";
import { RecentMessagesCard } from "./RecentMessagesCard";
import { ChannelPerformanceCard } from "./ChannelPerformanceCard";
import { CampaignPerformanceCard } from "./CampaignPerformanceCard";
import { ConnectChannels } from "./ConnectChannels";
import type { DashboardOverview, AnalyticsResponse } from "../state/overview-model";

export function OverviewSkeleton() {
  return <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)]"><Skeleton className="h-[25rem] rounded-lg" /><Skeleton className="h-[25rem] rounded-lg" /></div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div><Skeleton className="h-64 rounded-lg" /></div>;
}

export function CasualOverview({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  return <div className="space-y-4"><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)]"><AutomationStatusCard overview={overview} /><AtAGlance overview={overview} analytics={analytics} /></div><div className="grid items-stretch gap-4 xl:grid-cols-2"><RecentMessagesCard overview={overview} /><ChannelPerformanceCard analytics={analytics} /></div><ConnectChannels overview={overview} /></div>;
}

export function AdvancedOverview({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  return <div className="space-y-4"><div className="grid items-stretch gap-4 2xl:grid-cols-[minmax(26rem,0.95fr)_minmax(0,1.35fr)]"><AutomationStatusCard overview={overview} />{analytics ? <Metrics analytics={analytics} /> : <Skeleton className="h-full min-h-[20rem] rounded-lg" />}</div><div className="grid items-stretch gap-4 2xl:grid-cols-3"><RecentMessagesCard overview={overview} /><CampaignPerformanceCard analytics={analytics} /><ChannelPerformanceCard analytics={analytics} /></div><ConnectChannels overview={overview} /></div>;
}
