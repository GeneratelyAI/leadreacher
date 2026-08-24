import { Loading } from "@/components/ui/Loading";

/** Route transition fallback that keeps the persistent dashboard shell visible. */
export default function DashboardLoading() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center">
      <Loading tone="brand" label="Loading dashboard" />
    </div>
  );
}
