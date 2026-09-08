import Link from "next/link";
import { MessageSquare, CalendarDays, CheckCircle2, Users, ArrowRight } from "@/components/ui/icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";
import type { DashboardOverview, AnalyticsResponse } from "../state/overview-model";

export function AtAGlance({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  const rows = [
    { label: "Replies received", value: overview.metrics.replies, detail: analytics ? `${analytics.summary.replyRate}% reply rate` : "Recorded replies", icon: MessageSquare, href: "/dashboard/messages" },
    { label: "Meetings booked", value: overview.metrics.meetingsBooked, detail: "Recorded meetings", icon: CalendarDays, href: "/dashboard/prospects?reviewStatus=booked" },
    { label: "Customers", value: overview.metrics.customers ?? 0, detail: "Converted prospects", icon: CheckCircle2, href: "/dashboard/prospects" },
    { label: "Prospects reached", value: analytics?.summary.prospectsReached ?? overview.metrics.prospects, detail: "Distinct prospects", icon: Users, href: "/dashboard/analytics" },
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-app-border py-4"><CardTitle>At a glance</CardTitle></CardHeader>
      <div className="px-4">
        {rows.map(({ label, value, detail, icon: Icon, href }, index) => (
          <Link key={label} href={href} className={cn("flex items-center gap-3 px-1 py-4 transition-colors hover:bg-app-hover", index > 0 && "border-t border-app-border")}>
            <span className="inline-flex size-8 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200"><Icon className="size-5" aria-hidden /></span>
            <span className="w-16 text-xl font-semibold">{formatNumber(value)}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </Card>
  );
}
