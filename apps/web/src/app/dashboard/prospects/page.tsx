import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/PageFrame";
import { Prospects } from "@/components/dashboard/Prospects";

export default function ProspectsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Prospects />
      </Suspense>
    </PageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading prospects" />;
}
