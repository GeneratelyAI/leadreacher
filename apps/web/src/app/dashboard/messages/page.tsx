import { Suspense } from "react";
import { DashboardPageFrame, MessagesView } from "@/components/dashboard/DashboardWorkspaceViews";

export default function MessagesPage() {
  return (
    <DashboardPageFrame className="flex min-h-0 flex-1 flex-col max-lg:h-full max-lg:max-w-none max-lg:px-0 max-lg:py-0 lg:block">
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading messages…</div>}>
        <MessagesView />
      </Suspense>
    </DashboardPageFrame>
  );
}
