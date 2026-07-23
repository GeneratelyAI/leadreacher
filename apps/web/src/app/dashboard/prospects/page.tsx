import { Suspense } from "react";
import { DashboardPageFrame, ProspectsView } from "@/components/dashboard/DashboardWorkspaceViews";

export default function ProspectsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading prospects…</div>}>
        <ProspectsView />
      </Suspense>
    </DashboardPageFrame>
  );
}
