"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import shared from "./MobileOnboarding.module.css";
import styles from "./MobileProspects.module.css";

const insights = [
  {
    title: "Your offer",
    description: "Products, services, and value proposition",
    detail:
      "We look at your public website to understand what you sell and the problems your offer solves.",
  },
  {
    title: "Your customers",
    description: "Who you help and what they care about",
    detail:
      "We suggest audience criteria from your website. You can review, edit, or remove every suggested value before continuing.",
  },
  {
    title: "Your market",
    description: "Industry, landscape, and key trends",
    detail:
      "We use your public business description to identify a relevant market. Your campaign summary remains available as you refine your audience.",
  },
] as const;

function InsightIllustration({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#f0ebff" />
      {index === 0 ? (
        <g stroke="#5526d8" strokeWidth="2.4" strokeLinejoin="round">
          <path d="M12 23h24v15H12z" fill="#6335e7" />
          <path d="M10 18h28v6H10z" fill="#8859ff" />
          <path d="M24 18v20" stroke="#fff" />
          <path d="M24 18c-13 0-14-11-7-9 4 1 7 9 7 9Zm0 0c13 0 14-11 7-9-4 1-7 9-7 9Z" />
        </g>
      ) : index === 1 ? (
        <g fill="#5526d8">
          <circle cx="24" cy="18" r="5" />
          <circle cx="12" cy="21" r="4" />
          <circle cx="36" cy="21" r="4" />
          <path d="M15 36v-4a9 9 0 0 1 18 0v4H15Z" />
          <path
            opacity=".65"
            d="M5 34v-4a7 7 0 0 1 12-5 12 12 0 0 0-4 9H5Zm30 0a12 12 0 0 0-4-9 7 7 0 0 1 12 5v4h-8Z"
          />
        </g>
      ) : (
        <g stroke="#6335e7" strokeWidth="3" strokeLinecap="round">
          <path d="M12 36V28m8 8V22m8 14V17m8 19V11" />
          <path d="m10 23 10-7 8 1 9-10" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

export function MobileWebsiteEntry({
  value,
  onChange,
  onSubmit,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
  error: string | null;
}) {
  const [detail, setDetail] = useState<number | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  return (
    <div className={styles.website}>
      <header>
        <h1>Tell us about your business.</h1>
        <p>We&apos;ll use your website to understand what you offer.</p>
      </header>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="mobile-business-website">Website</label>
        <input
          id="mobile-business-website"
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required
          aria-describedby={
            error ? "mobile-website-error" : "mobile-website-hint"
          }
          aria-invalid={Boolean(error)}
        />
        <p id="mobile-website-hint">
          Enter your website. We&apos;ll analyze your content to learn about
          your offer, customers, and market.
        </p>
        {error ? (
          <p role="alert" id="mobile-website-error" className={styles.error}>
            {error}
          </p>
        ) : null}
        <section className={styles.insights} aria-label="What we look for">
          <h2>What we look for</h2>
          {insights.map((item, index) => (
            <button
              type="button"
              key={item.title}
              onClick={(event) => {
                detailTrigger.current = event.currentTarget;
                setDetail(index);
              }}
            >
              <InsightIllustration index={index} />
              <span>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          ))}
        </section>
        <button type="submit" className={shared.primary} disabled={disabled}>
          {disabled
            ? "Understanding your business..."
            : "Understand my business"}
        </button>
      </form>
      <Sheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent
          side="bottom"
          className={cn(shared.sheet, styles.insightSheet)}
          overlayClassName={shared.sheetBackdrop}
          finalFocus={detailTrigger}
        >
          <span className={shared.handle} aria-hidden />
          <SheetTitle>
            {detail !== null ? insights[detail].title : "Website insights"}
          </SheetTitle>
          <SheetDescription>
            {detail !== null ? insights[detail].detail : ""}
          </SheetDescription>
          <SheetClose className={shared.primary}>Got it</SheetClose>
        </SheetContent>
      </Sheet>
    </div>
  );
}
