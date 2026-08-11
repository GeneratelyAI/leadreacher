import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type EdgeSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section";
  tone?: "light" | "dark";
  children: ReactNode;
};

export function EdgeSurface({ as: Component = "section", tone = "light", className, children, ...props }: EdgeSurfaceProps) {
  return (
    <Component
      className={cn(
        "relative isolate overflow-hidden rounded-t-[28px] sm:rounded-t-[40px]",
        tone === "dark" ? "bg-[#0d1020] text-white" : "bg-white text-[#111527]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
