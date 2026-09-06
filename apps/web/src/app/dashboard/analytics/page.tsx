import { Suspense } from "react";
import { Analytics } from "@/components/dashboard/Analytics";
import { Frame } from "@/components/dashboard/Frame";

export default function AnalyticsPage() {
  return (
    <Frame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Analytics />
      </Suspense>
    </Frame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading analytics" />;
}
