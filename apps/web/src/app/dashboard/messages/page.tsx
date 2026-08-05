import { Suspense } from "react";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";
import { MessagesWorkspace } from "@/components/dashboard/MessagesWorkspace";

export default function MessagesPage() {
  return (
    <DashboardPageFrame className="flex min-h-0 flex-1 flex-col max-lg:h-full max-lg:max-w-none max-lg:px-0 max-lg:py-0 lg:block">
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <MessagesWorkspace />
      </Suspense>
    </DashboardPageFrame>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-[32rem] animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading chat" />;
}
