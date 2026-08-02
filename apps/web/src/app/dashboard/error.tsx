"use client";

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
        <p className="mt-2 text-sm text-muted-foreground">Your workspace data has not been changed. Try loading the view again.</p>
        <Button className="mt-4" variant="brand" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
