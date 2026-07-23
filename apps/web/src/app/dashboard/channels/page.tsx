import { Suspense } from "react";
import { ChannelsView, DashboardPageFrame } from "@/components/dashboard/DashboardWorkspaceViews";

export default function ChannelsPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading channels…</div>}>
        <ChannelsView />
      </Suspense>
    </DashboardPageFrame>
  );
}
