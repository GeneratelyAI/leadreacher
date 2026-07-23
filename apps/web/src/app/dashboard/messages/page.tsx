import { Suspense } from "react";
import { DashboardPageFrame, MessagesView } from "@/components/dashboard/DashboardWorkspaceViews";

export default function MessagesPage() {
  return (
    <DashboardPageFrame>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading messages…</div>}>
        <MessagesView />
      </Suspense>
    </DashboardPageFrame>
  );
}
