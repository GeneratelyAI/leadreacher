import { Suspense } from "react";
import { Messages } from "@/components/dashboard/Messages";

export default function MessagesPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <Messages />
      </Suspense>
    </div>
  );
}

function DashboardRouteSkeleton() {
  return <div className="h-[32rem] animate-pulse rounded-lg border border-app-border bg-app-elevated" aria-label="Loading chat" />;
}
