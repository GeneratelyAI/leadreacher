import { Suspense } from "react";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";
import { ProspectsWorkspace } from "@/components/dashboard/ProspectsWorkspace";

export default function ProspectsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ProspectsWorkspace />
      </Suspense>
    </DashboardPageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading prospects" />;
}
