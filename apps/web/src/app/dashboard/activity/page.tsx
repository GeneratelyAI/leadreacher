import { Suspense } from "react";
import { Activity } from "@/components/dashboard/Activity";
import { PageFrame } from "@/components/dashboard/PageFrame";

export default function ActivityPage() {
  return (
    <PageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Activity />
      </Suspense>
    </PageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading activity" />;
}
