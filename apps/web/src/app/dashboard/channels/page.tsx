import { Suspense } from "react";
import { Channels } from "@/features/channels/public/Channels";
import { Frame } from "@/components/dashboard/Frame";

export default function ChannelsPage() {
  return (
    <Frame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Channels />
      </Suspense>
    </Frame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading channels" />;
}
