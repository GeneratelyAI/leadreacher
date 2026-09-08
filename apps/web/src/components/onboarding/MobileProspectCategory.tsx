"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { X } from "@/components/ui/icons";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { useMobileCampaign } from "@/hooks/useMobileCampaign";
import { type ProspectCategory } from "@/lib/prospect-details";
import { cn } from "@/lib/utils";
import shared from "./MobileOnboarding.module.css";
import styles from "./MobileProspects.module.css";

/** Uses untransformed chip widths, including the actual overflow label. */
export function fitProspectRows(
  widths: number[],
  moreWidths: number[],
  available: number,
  gap = 8,
) {
  function fits(count: number) {
    const items = widths.slice(0, count);
    if (count < widths.length)
      items.push(moreWidths[widths.length - count] ?? 70);
    let row = 1;
    let used = 0;
    for (const width of items) {
      if (width > available) return false;
      if (used && used + gap + width > available) {
        row += 1;
        used = 0;
      }
      used += (used ? gap : 0) + width;
    }
    return row <= 2;
  }
  for (let count = widths.length; count >= 0; count -= 1)
    if (fits(count)) return count;
  return 0;
}

export function MobileProspectCategory({
  category,
  label,
  values,
  onRemove,
  onAdd,
  initialOpen = false,
}: {
  category: ProspectCategory;
  label: string;
  values: string[];
  onRemove: (category: ProspectCategory, value: string) => void;
  onAdd: (category: ProspectCategory, value: string) => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [visibleCount, setVisibleCount] = useState(0);
  const [input, setInput] = useState("");
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const claimedRemovals = useRef(new Set<string>());
  const railRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const focusReturn = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useStableReducedMotion();
  const mobile = useMobileCampaign();
  const previousMobile = useRef(mobile);
  useLayoutEffect(() => {
    for (const value of claimedRemovals.current) {
      if (!values.includes(value)) claimedRemovals.current.delete(value);
    }
  }, [values]);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const measure = measureRef.current;
    if (!rail || !measure) return;
    let cancelled = false;
    const update = () => {
      if (cancelled || !rail.clientWidth) return;
      const widths = Array.from(
        measure.querySelectorAll<HTMLElement>("[data-measure-value]"),
      ).map((node) => node.offsetWidth);
      const moreWidths = [
        0,
        ...Array.from(
          measure.querySelectorAll<HTMLElement>("[data-measure-more]"),
        ).map((node) => node.offsetWidth),
      ];
      setVisibleCount(fitProspectRows(widths, moreWidths, rail.clientWidth));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    observer.observe(measure);
    void document.fonts.ready.then(update);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [values]);

  const finishRemovals = useCallback(() => {
    const removed = [...pending.current];
    pending.current.clear();
    removed.forEach((value) => onRemove(category, value));
    setRemoving(new Set());
  }, [category, onRemove]);
  useLayoutEffect(() => {
    if (previousMobile.current && !mobile) {
      finishRemovals();
      setOpen(false);
    }
    previousMobile.current = mobile;
  }, [mobile, finishRemovals]);
  function changeOpen(next: boolean) {
    if (!next) finishRemovals();
    setOpen(next);
  }
  function remove(value: string) {
    if (claimedRemovals.current.has(value)) return;
    claimedRemovals.current.add(value);
    if (reduceMotion) {
      onRemove(category, value);
      return;
    }
    pending.current.add(value);
    setRemoving(new Set(pending.current));
  }
  function show(trigger: HTMLButtonElement) {
    focusReturn.current = trigger;
    setOpen(true);
  }
  const hidden = values.length - visibleCount;
  return (
    <div className={styles.category}>
      <div className={styles.categoryHeading}>
        <h2>{label}</h2>
        <button
          type="button"
          ref={editRef}
          onClick={(event) => show(event.currentTarget)}
          aria-label={`Edit ${label}`}
        >
          Edit
        </button>
      </div>
      <div
        ref={railRef}
        className={styles.overview}
        aria-label={`${label} selected values`}
      >
        {values.slice(0, visibleCount).map((value) => (
          <span
            key={value}
            className={cn(styles.chip, "onboarding-campaign-chip-label")}
          >
            {value}
          </span>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            className={cn(styles.chip, styles.more)}
            data-prospect-overflow-trigger={category}
            aria-label={`Show ${hidden} more ${label.toLowerCase()}`}
            onClick={(event) => show(event.currentTarget)}
          >
            +{hidden} more
          </button>
        ) : null}
        {!values.length ? (
          <span className={styles.empty}>No suggestion yet</span>
        ) : null}
      </div>
      <div ref={measureRef} className={styles.measure} aria-hidden>
        {values.map((value) => (
          <span key={value} data-measure-value className={styles.chip}>
            {value}
          </span>
        ))}
        {values.map((_, index) => (
          <span
            key={index}
            data-measure-more
            className={cn(styles.chip, styles.more)}
          >
            +{index + 1} more
          </span>
        ))}
      </div>
      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetContent
          side="bottom"
          className={cn(shared.sheet, styles.editSheet)}
          overlayClassName={shared.sheetBackdrop}
          initialFocus={headingRef}
          finalFocus={() => {
            if (!mobile) {
              // Desktop chips may still be finishing a pending removal. The
              // shared audience input remains stable across the handoff.
              return document.getElementById("prospect-context");
            }
            return focusReturn.current?.isConnected
              ? focusReturn.current
              : editRef.current;
          }}
        >
          <span className={shared.handle} aria-hidden />
          <div>
            <SheetTitle ref={headingRef} tabIndex={-1}>
              {label}
            </SheetTitle>
            <SheetDescription>
              {values.length - removing.size} selected
            </SheetDescription>
          </div>
          <div className={styles.editValues}>
            <AnimatePresence
              initial={false}
              mode="popLayout"
              onExitComplete={finishRemovals}
            >
              {values
                .filter((value) => !removing.has(value))
                .map((value) => (
                  <motion.span
                    key={value}
                    layout={reduceMotion ? false : "position"}
                    initial={false}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.86, y: -3 }
                    }
                    transition={{
                      duration: reduceMotion ? 0 : 0.21,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={cn(styles.chip, styles.editChip)}
                  >
                    <span>{value}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${value} from ${label}`}
                      onClick={() => remove(value)}
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </motion.span>
                ))}
            </AnimatePresence>
            {!values.length ? (
              <p className={styles.empty}>No suggestion yet</p>
            ) : null}
          </div>
          <form
            className={styles.addRow}
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.trim()) return;
              onAdd(category, input);
              setInput("");
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label={`Add to ${label}`}
              placeholder={`Add ${category === "decisionMakers" ? "a decision maker" : category === "companyTypes" ? "a company type" : category === "industries" ? "an industry" : "a location"}`}
            />
            <button type="submit" disabled={!input.trim()}>
              Add
            </button>
          </form>
          <SheetClose className={shared.primary}>Done</SheetClose>
        </SheetContent>
      </Sheet>
    </div>
  );
}
