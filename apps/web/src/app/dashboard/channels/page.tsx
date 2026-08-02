import { Suspense } from "react";
import { ChannelsWorkspace } from "@/components/dashboard/ChannelsWorkspace";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";

export default function ChannelsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ChannelsWorkspace />
      </Suspense>
    </DashboardPageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading channels" />;
}
