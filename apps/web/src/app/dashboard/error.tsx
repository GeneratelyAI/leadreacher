"use client";

import Link from "next/link";
import { LayoutDashboard, RefreshCw } from "@/components/ui/icons";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route failed", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-72 w-full max-w-[104rem] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">This dashboard view could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your workspace data has not been changed. Reload this view or return to the overview.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="brand" onClick={reset}>
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" aria-hidden />
              Go to overview
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
