"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./Loading.module.css";

type LoadingProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Use reference on the purple brand surface and brand on light surfaces. */
  tone?: "reference" | "brand";
  label?: string;
};

/** LeadReacher's shared page-level loading indicator. */
export function Loading({ className, tone = "reference", label = "Loading", ...props }: LoadingProps) {
  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={props["aria-label"] ?? label}
      className={cn(styles.loading, tone === "brand" && styles.brand, className)}
    >
      <svg className={styles.trails} viewBox="0 0 33 64" aria-hidden>
        <path d="M26 4c2 9.333 3 18.667 3 28 0 9.333-1 18.667-3 28" />
        <path d="M6 4c2 9.333 3 18.667 3 28 0 9.333-1 18.667-3 28" />
      </svg>
      <span className={styles.plane} aria-hidden>
        <span className={styles.left} />
        <span className={styles.right} />
      </span>
    </div>
  );
}
