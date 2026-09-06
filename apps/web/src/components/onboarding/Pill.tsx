"use client";

import { Check, ChevronDown, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useId, useMemo, useState } from "react";

export type PillField = {
  label: string;
  value: string;
};

export type PillData = {
  status?: "learning" | "ready";
  statusLabel?: string;
  fields: PillField[];
  site?: {
    label: string;
    iconUrl: string;
  };
};

type PillProps = {
  campaign: PillData;
  className?: string;
  defaultExpanded?: boolean;
};

function reducedMotionPreferred() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A compact, progressively populated campaign brief for onboarding. */
export function Pill({
  campaign,
  className,
  defaultExpanded = true,
}: PillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(reducedMotionPreferred);
  const contentId = useId();
  const serializedFields = JSON.stringify(campaign.fields);
  const fields = useMemo<PillField[]>(() => JSON.parse(serializedFields), [serializedFields]);
  const [reveal, setReveal] = useState(() => ({ signature: serializedFields, count: 0 }));
  const visibleFieldCount = reveal.signature === serializedFields ? reveal.count : 0;
  const isRevealing = visibleFieldCount < fields.length;
  const isLearning = campaign.status === "learning" || isRevealing;
  const site = campaign.site ?? {
    label: "leadreacher.ai",
    iconUrl: "/logo/leadreacher_icon_colored.svg",
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", syncPreference);
    return () => query.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setReveal({ signature: serializedFields, count: fields.length });
      return;
    }

    setReveal({ signature: serializedFields, count: 0 });
    const timers = fields.map((_, index) => window.setTimeout(
      () => setReveal((current) => (
        current.signature === serializedFields
          ? { ...current, count: index + 1 }
          : current
      )),
      320 + index * 720,
    ));

    return () => timers.forEach(window.clearTimeout);
  }, [fields, prefersReducedMotion, serializedFields]);

  const visibleFields = fields.slice(0, visibleFieldCount);
  const statusLabel = campaign.status === "learning"
    ? campaign.statusLabel ?? "Understanding your business"
    : isRevealing
      ? "Building your campaign"
      : campaign.statusLabel ?? "Business understood";

  return (
    <section
      className={cn("campaign-pill", expanded && "campaign-pill-expanded", className)}
      aria-label="Your campaign"
    >
      <div className="campaign-pill-ambient" aria-hidden />
      <div className="campaign-pill-site" aria-label={`Website: ${site.label}`}>
        <Image
          src={site.iconUrl}
          alt=""
          width={32}
          height={32}
          className="campaign-pill-site-icon"
        />
        <span className="campaign-pill-site-url">{site.label}</span>
      </div>
      <header className="campaign-pill-header">
        <p className="campaign-pill-title">Your campaign</p>
        <button
          type="button"
          className="campaign-pill-toggle"
          aria-label={expanded ? "Collapse your campaign" : "Expand your campaign"}
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown className="size-5" aria-hidden />
        </button>
      </header>

      <div className="campaign-pill-status" aria-live="polite">
        <span className={cn("campaign-pill-status-icon", isLearning && "campaign-pill-status-icon-learning")} aria-hidden>
          {isLearning ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" weight="bold" />}
        </span>
        <span>{statusLabel}</span>
      </div>

      <div id={contentId} className="campaign-pill-body" aria-hidden={!expanded}>
        <div className="campaign-pill-fields">
          {visibleFields.map((field) => (
            <div
              className="campaign-pill-field"
              key={`${field.label}:${field.value}`}
            >
              <p>{field.label}</p>
              <span>{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
