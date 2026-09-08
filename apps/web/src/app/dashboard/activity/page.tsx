import { Suspense } from "react";
import { Activity } from "@/features/analytics/public/Activity";
import { Frame } from "@/components/dashboard/Frame";

export default function ActivityPage() {
  return (
    <Frame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Activity />
      </Suspense>
    </Frame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading activity" />;
}
