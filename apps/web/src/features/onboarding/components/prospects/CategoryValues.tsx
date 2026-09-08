"use client";

import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ProspectProfile } from "../../state/prospect-profile";

const CHIP_GAP = 10.4;

type ProspectCategoryValuesProps = {
  category: keyof ProspectProfile;
  label: string;
  values: string[];
  removing: Set<string>;
  onRemove: (category: keyof ProspectProfile, value: string) => void;
  onExitComplete: (category: keyof ProspectProfile) => void;
  prospectId: (category: keyof ProspectProfile, value: string) => string;
  reduceMotion: boolean | null;
};

export function ProspectCategoryValues({ category, label, values, removing, onRemove, onExitComplete, prospectId, reduceMotion }: ProspectCategoryValuesProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const suppressTriggerFocusRef = useRef(false);
  const [visibleIndexes, setVisibleIndexes] = useState<number[] | null>(null);
  const [reservedWidths, setReservedWidths] = useState<number[]>([]);
  const [collapsedWidths, setCollapsedWidths] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const overflowValues = visibleIndexes === null ? [] : values.filter((_, index) => !visibleIndexes.includes(index));
  const popoverId = `prospect-overflow-${category}`;

  useEffect(() => {
    if (!open || overflowValues.length) return;
    setOpen(false);
    railRef.current?.querySelector<HTMLButtonElement>(".onboarding-campaign-chip-remove")?.focus({ preventScroll: true });
  }, [open, overflowValues.length]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const measure = measureRef.current;
    if (!rail || !measure) return;
    let frame = 0;
    const recalculate = () => {
      const railStyle = window.getComputedStyle(rail);
      const available = rail.clientWidth - Number.parseFloat(railStyle.paddingLeft) - Number.parseFloat(railStyle.paddingRight);
      const chips = Array.from(measure.querySelectorAll<HTMLElement>("[data-chip-measure]"));
      const expandedChips = Array.from(measure.querySelectorAll<HTMLElement>("[data-chip-expanded-measure]"));
      const triggers = new Map(Array.from(measure.querySelectorAll<HTMLElement>("[data-trigger-measure]")).map((node) => [Number(node.dataset.triggerMeasure), node.offsetWidth]));
      // offsetWidth rounds to an integer. Round the untransformed CSS width up
      // instead so subpixel text metrics cannot lose their final glyph.
      const nextReservedWidths = expandedChips.map((chip) => Math.ceil(Number.parseFloat(getComputedStyle(chip).width)));
      let next = values.map((_, index) => index);
      for (let count = values.length; count >= 0; count -= 1) {
        const candidate = [...Array(count).keys()];
        const hidden = values.length - candidate.length;
        const width = candidate.reduce((sum, index) => sum + (nextReservedWidths[index] ?? 0), 0)
          + Math.max(0, candidate.length - 1) * CHIP_GAP
          + (hidden ? (candidate.length ? CHIP_GAP : 0) + (triggers.get(hidden) ?? 0) : 0);
        if (width <= available) {
          next = candidate;
          break;
        }
      }
      setVisibleIndexes(next);
      setReservedWidths(nextReservedWidths);
      setCollapsedWidths(chips.map((chip) => chip.offsetWidth));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(recalculate);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(rail);
    void document.fonts?.ready?.then(schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [values]);

  const popoverReady = open && position !== null && overflowValues.length > 0;
  useLayoutEffect(() => {
    if (!popoverReady || !popoverRef.current) return;
    if (!popoverRef.current.contains(document.activeElement)) {
      closeRef.current?.focus({ preventScroll: true });
    }
  }, [popoverReady]);

  useEffect(() => {
    if (!open || !overflowValues.length) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = popoverRef.current?.offsetWidth ?? 368;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 240;
      const horizontalInset = 16;
      const verticalInset = 16;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const left = Math.max(viewportLeft + horizontalInset, Math.min(rect.left, viewportLeft + viewportWidth - popoverWidth - horizontalInset));
      const preferredTop = rect.bottom + 8;
      const top = preferredTop + popoverHeight <= viewportTop + viewportHeight - verticalInset
        ? preferredTop
        : Math.max(viewportTop + verticalInset, rect.top - popoverHeight - 8);
      if (popoverRef.current) popoverRef.current.style.maxHeight = `${Math.max(44, viewportHeight - 2 * verticalInset)}px`;
      setPosition({ left, top });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      suppressTriggerFocusRef.current = true;
      triggerRef.current?.focus({ preventScroll: true });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      suppressTriggerFocusRef.current = true;
      triggerRef.current?.focus({ preventScroll: true });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    const observer = new ResizeObserver(updatePosition);
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      if (popoverRef.current) observer.observe(popoverRef.current);
    });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, overflowValues.length]);

  const renderChip = (value: string, index: number, reserveWidth = false) => {
    const accessibleLabel = `Remove ${value} from ${label}`;
    return (
      <motion.div
        layout={reduceMotion ? false : "position"}
        key={value}
        className={cn("onboarding-campaign-chip-slot", reserveWidth && "onboarding-campaign-chip-slot-reserved")}
        style={reserveWidth && reservedWidths[index] ? {
          "--prospect-chip-slot-width": `${reservedWidths[index]}px`,
          "--prospect-chip-collapsed-offset": `${Math.max(0, reservedWidths[index] - (collapsedWidths[index] ?? reservedWidths[index]))}px`,
        } as CSSProperties : undefined}
        initial={false}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: -3, filter: "blur(2px)" }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="onboarding-campaign-chip"
          whileHover={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
          whileFocus={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="onboarding-campaign-chip-label">{value}</span>
          <button type="button" className="onboarding-campaign-chip-remove" onClick={() => onRemove(category, value)} aria-label={accessibleLabel}><X className="size-3.5" aria-hidden /></button>
        </motion.div>
      </motion.div>
    );
  };

  const finishExits = () => onExitComplete(category);
  return <>
    <div ref={railRef} className="onboarding-campaign-profile-values onboarding-campaign-profile-rail" data-measured={visibleIndexes === null ? undefined : "true"}>
      {values.length ? <AnimatePresence initial={false} mode="popLayout" onExitComplete={finishExits}>
        {visibleIndexes === null
          ? values.filter((value) => !removing.has(prospectId(category, value))).map((value, index) => renderChip(value, index))
          : visibleIndexes.filter((index) => !removing.has(prospectId(category, values[index]))).map((index) => renderChip(values[index], index, true))}
      </AnimatePresence> : <span className="onboarding-campaign-empty">No suggestion yet</span>}
      {overflowValues.length ? <button ref={triggerRef} data-prospect-overflow-trigger={category} type="button" className="onboarding-campaign-overflow-trigger" aria-label={`Show ${overflowValues.length} more ${label.toLowerCase()}`} aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen(true)} onFocus={() => { if (suppressTriggerFocusRef.current) { suppressTriggerFocusRef.current = false; return; } setOpen(true); }}>+{overflowValues.length} more</button> : null}
    </div>
    <div ref={measureRef} className="onboarding-campaign-chip-measure" aria-hidden="true">
      {values.map((value) => <span key={value} data-chip-measure className="onboarding-campaign-chip-measure-item"><span className="onboarding-campaign-chip-label">{value}</span></span>)}
      {values.map((value) => <span key={value} data-chip-expanded-measure className="onboarding-campaign-chip-measure-item onboarding-campaign-chip-measure-expanded"><span className="onboarding-campaign-chip-label">{value}</span><span className="onboarding-campaign-chip-remove"><X className="size-3.5" /></span></span>)}
      {values.map((_, index) => <span key={index} data-trigger-measure={values.length - index} className="onboarding-campaign-overflow-trigger">+{values.length - index} more</span>)}
    </div>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && position && overflowValues.length ? <motion.div id={popoverId} ref={popoverRef} role="dialog" aria-label={`${label} selections`} className="onboarding-campaign-overflow-popover" style={{ left: position.left, top: position.top }} initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      <div className="onboarding-campaign-overflow-heading"><div><strong>{label}</strong><span>{values.length} selected</span></div><button ref={closeRef} type="button" aria-label={`Close ${label}`} onClick={() => { setOpen(false); suppressTriggerFocusRef.current = true; triggerRef.current?.focus({ preventScroll: true }); }}><X className="size-4" aria-hidden /></button></div>
      <div className="onboarding-campaign-overflow-values"><AnimatePresence initial={false} mode="popLayout" onExitComplete={finishExits}>{values.map((value, index) => ({ value, index })).filter(({ index }) => !visibleIndexes?.includes(index) && !removing.has(prospectId(category, values[index]))).map(({ value, index }) => renderChip(value, index))}</AnimatePresence></div>
    </motion.div> : null}</AnimatePresence>, document.body)}
  </>;
}
