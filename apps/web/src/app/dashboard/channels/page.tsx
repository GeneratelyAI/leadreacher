import { Suspense } from "react";
import { Channels } from "@/components/dashboard/Channels";
import { PageFrame } from "@/components/dashboard/PageFrame";

export default function ChannelsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Channels />
      </Suspense>
    </PageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading channels" />;
}
