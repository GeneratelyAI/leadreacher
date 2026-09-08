import { Suspense } from "react";
import { Frame } from "@/components/dashboard/Frame";
import { Prospects } from "@/features/prospects/public/Prospects";

export default function ProspectsPage() {
  return (
    <Frame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Prospects />
      </Suspense>
    </Frame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading prospects" />;
}
