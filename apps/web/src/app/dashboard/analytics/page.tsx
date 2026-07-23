import { Suspense } from "react";
import { AnalyticsView, DashboardPageFrame } from "@/components/dashboard/DashboardWorkspaceViews";

export default function AnalyticsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>}>
        <AnalyticsView />
      </Suspense>
    </DashboardPageFrame>
  );
}
