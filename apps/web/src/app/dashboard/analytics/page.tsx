import { Suspense } from "react";
import { AnalyticsWorkspace } from "@/components/dashboard/AnalyticsWorkspace";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";

export default function AnalyticsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <AnalyticsWorkspace />
      </Suspense>
    </DashboardPageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading analytics" />;
}
