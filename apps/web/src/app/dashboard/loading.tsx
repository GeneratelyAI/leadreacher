function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800 ${className}`} />;
}

/** Route transition fallback that keeps the persistent dashboard shell visible. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[104rem] space-y-5 px-[var(--dashboard-page-px,1rem)] py-[var(--dashboard-page-py,1.25rem)]">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-[min(32rem,80%)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-52" />
    </div>
  );
}
