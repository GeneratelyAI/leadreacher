import { Suspense } from "react";
import { Analytics } from "@/components/dashboard/Analytics";
import { PageFrame } from "@/components/dashboard/PageFrame";

export default function AnalyticsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Analytics />
      </Suspense>
    </PageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading analytics" />;
}
