"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TruncatedWithTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return false;
    const isTruncated = node.scrollWidth > node.clientWidth + 1;
    setTruncated(isTruncated);
    return isTruncated;
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, text]);

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !measure()) {
          setOpen(false);
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <TooltipTrigger
        render={
          <span
            ref={ref}
            className={cn("min-w-0 flex-1 truncate", className)}
            onMouseEnter={measure}
            onFocus={measure}
          />
        }
      >
        {text}
      </TooltipTrigger>
      {truncated ? (
        <TooltipContent side="top" sideOffset={6} className="z-[70] max-w-xs text-pretty">
          {text}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
