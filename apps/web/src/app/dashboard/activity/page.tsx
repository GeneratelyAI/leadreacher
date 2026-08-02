import { Suspense } from "react";
import { ActivityWorkspace } from "@/components/dashboard/ActivityWorkspace";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";

export default function ActivityPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ActivityWorkspace />
      </Suspense>
    </DashboardPageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading activity" />;
}
