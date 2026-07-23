import { Suspense } from "react";
import { ActivityView, DashboardPageFrame } from "@/components/dashboard/DashboardWorkspaceViews";

export default function ActivityPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading activity…</div>}>
        <ActivityView />
      </Suspense>
    </DashboardPageFrame>
  );
}
