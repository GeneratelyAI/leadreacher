"use client";

import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check } from "@/components/ui/icons";
import { appendProspectDetail, classifyProspectDetail, PROSPECT_CATEGORIES, splitProspectDetails, type ProspectCategory, type ProspectDetails } from "@/lib/prospect-details";

export function ProspectDetailInput({ profile, setProfile, onContextChange, disabled }: {
  profile: ProspectDetails;
  setProfile: Dispatch<SetStateAction<ProspectDetails>>;
  onContextChange: (value: string) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProspectCategory | null>(null);
  const [selectorHeight, setSelectorHeight] = useState(0);
  const [selectorReady, setSelectorReady] = useState(false);
  const [selectorClosing, setSelectorClosing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const arrivals = useRef<Array<{ category: ProspectCategory; value: string; source: DOMRect }>>([]);
  const cleanup = useRef<Set<() => void>>(new Set());
  const selectorTimers = useRef<Set<number>>(new Set());

  useEffect(() => {
    onContextChange([...pending, input.trim()].filter(Boolean).join("; "));
  }, [pending, input, onContextChange]);
  useEffect(() => () => {
    cleanup.current.forEach((dispose) => dispose());
    selectorTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);
  useLayoutEffect(() => {
    let measureFrame = 0;
    let readyFrame = 0;

    if (!pending[0]) {
      setSelectorReady(false);
      setSelectorClosing(false);
      setSelectorHeight(0);
      return;
    }

    setSelectorReady(false);
    setSelectorClosing(false);
    const measure = () => {
      const height = Math.ceil(selectorRef.current?.getBoundingClientRect().height ?? 0);
      setSelectorHeight(height);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSelectorReady(true);
        return;
      }
      readyFrame = window.requestAnimationFrame(() => setSelectorReady(true));
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      measure();
      return;
    }
    measureFrame = window.requestAnimationFrame(measure);
    return () => {
      window.cancelAnimationFrame(measureFrame);
      window.cancelAnimationFrame(readyFrame);
    };
  }, [pending]);
  function place(entries: Array<{ category: ProspectCategory; value: string }>) {
    let next = profile;
    const added: typeof entries = [];
    for (const entry of entries) {
      const updated = appendProspectDetail(next, entry.category, entry.value);
      if (updated !== next) added.push(entry);
      next = updated;
    }
    const source = inputRef.current?.getBoundingClientRect();
    if (source) arrivals.current = added.map((entry) => ({ ...entry, source }));
    setProfile(next);
    setAnnouncement(added.length ? added.map(({ category, value }) => `${value} added to ${PROSPECT_CATEGORIES.find((item) => item.key === category)!.label}.`).join(" ") : "Those details are already in your audience.");
    inputRef.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const entries = arrivals.current;
    arrivals.current = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const task = inputRef.current?.closest(".onboarding-campaign-task");
    const frames = new Set<number>();
    const beginTravel = ({ category, value, source }: typeof entries[number], index: number) => {
      const row = task?.querySelector<HTMLElement>(`[data-prospect-row="${category}"]`);
      const chip = Array.from(row?.querySelectorAll<HTMLElement>(".onboarding-campaign-chip-label") ?? []).find((node) => node.textContent === value);
      const overflowTrigger = row?.querySelector<HTMLElement>(`[data-prospect-overflow-trigger="${category}"]`);
      const destinationTarget = chip ?? overflowTrigger;
      if (!row || !destinationTarget) return;
      const destination = destinationTarget.getBoundingClientRect();
      const travel = document.createElement("span");
      travel.className = "discovery-detail-traveler";
      travel.textContent = value;
      travel.setAttribute("aria-hidden", "true");
      Object.assign(travel.style, { left: `${source.left + 16}px`, top: `${source.top}px`, maxWidth: `${Math.min(source.width - 32, 220)}px` });
      document.body.appendChild(travel);
      const delay = Math.min(index, 3) * 35;
      const travelTiming = { duration: 620, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" as const };
      const animations = [
        travel.animate([
          { opacity: 0, transform: "translate(0,0) scale(.9)" },
          { opacity: .9, offset: .2 },
          { opacity: 0, transform: `translate(${destination.left - source.left - 16}px,${destination.top - source.top}px) scale(.85)` },
        ], travelTiming),
        row.animate([{ backgroundColor: "rgba(111,75,241,0)", boxShadow: "inset 0 0 0 1px transparent" }, { backgroundColor: "rgba(111,75,241,.07)", boxShadow: "inset 0 0 0 1px rgba(111,75,241,.22)", offset: .45 }, { backgroundColor: "rgba(111,75,241,0)", boxShadow: "inset 0 0 0 1px transparent" }], travelTiming),
      ];
      if (!chip && overflowTrigger) {
        animations.push(overflowTrigger.animate([
          { backgroundColor: "#faf8ff", borderColor: "#cdbdff" },
          { backgroundColor: "#eee9ff", borderColor: "#8d70ee", offset: .48 },
          { backgroundColor: "#faf8ff", borderColor: "#cdbdff" },
        ], { duration: 260, delay: delay + 360, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }));
      }
      const dispose = () => { animations.forEach((animation) => animation.cancel()); travel.remove(); cleanup.current.delete(dispose); };
      cleanup.current.add(dispose);
      void Promise.all(animations.map((animation) => animation.finished)).then(dispose, dispose);
    };

    entries.forEach((entry, index) => {
      const firstFrame = window.requestAnimationFrame(() => {
        frames.delete(firstFrame);
        const secondFrame = window.requestAnimationFrame(() => {
          frames.delete(secondFrame);
          beginTravel(entry, index);
        });
        frames.add(secondFrame);
      });
      frames.add(firstFrame);
    });
    return () => frames.forEach((frame) => window.cancelAnimationFrame(frame));
  }, [profile]);

  function submit(raw = input) {
    const classified = splitProspectDetails(raw).map(classifyProspectDetail);
    const known = classified.filter((entry): entry is { category: ProspectCategory; value: string } => entry.category !== null);
    const unknown = classified.filter((entry) => entry.category === null).map((entry) => entry.value);
    setPending((current) => splitProspectDetails([...current, ...unknown].join(";")));
    if (known.length) place(known);
    else inputRef.current?.focus({ preventScroll: true });
    setInput("");
  }

  function selectCategory(category: ProspectCategory) {
    const value = pending[0];
    if (!value || selectedCategory) return;
    setSelectedCategory(category);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      place([{ category, value }]);
      setSelectorClosing(true);
      setSelectorHeight(0);
      setPending((current) => current[0] === value ? current.slice(1) : current);
      setSelectedCategory(null);
      return;
    }
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        selectorTimers.current.delete(timer);
        callback();
      }, delay);
      selectorTimers.current.add(timer);
    };

    schedule(() => {
      place([{ category, value }]);
      setSelectorClosing(true);
      schedule(() => {
        setSelectorHeight(0);
      }, 220);
      schedule(() => {
        setPending((current) => current[0] === value ? current.slice(1) : current);
        setSelectedCategory(null);
      }, 660);
    }, 180);
  }

  return (
    <form className="onboarding-campaign-context discovery-detail-editor" onSubmit={(event) => { event.preventDefault(); if (input.trim() && !disabled) submit(); }}>
      <label htmlFor="prospect-context">Did we miss anything?</label>
      <div className="discovery-detail-entry">
        <input ref={inputRef} id="prospect-context" className="onboarding-campaign-context-input" value={input} disabled={disabled}
          onChange={(event) => setInput(event.target.value)} placeholder="Add a role, company type, industry or location..."
          onPaste={(event) => { const text = event.clipboardData.getData("text"); if (/[\r\n]/.test(text)) { event.preventDefault(); setInput((current) => current + text.replace(/[\r\n]+/g, "; ")); } }} />
        <button className="discovery-detail-add" type="submit" disabled={disabled || !input.trim()}>Add</button>
      </div>
      <div className="discovery-detail-fallback" aria-live="polite" style={{ height: `${selectorHeight}px` }}>
        {pending[0] ? <>
          <div
            ref={selectorRef}
            className="discovery-detail-selector"
            data-ready={selectorReady}
            data-closing={selectorClosing || undefined}
            key={pending[0]}
          >
            <p title={pending[0]}>Where does <strong>{pending[0]}</strong> belong?</p>
            <div role="group" aria-label={`Choose a category for ${pending[0]}`}>
              {PROSPECT_CATEGORIES.map(({ key, label }) => {
                const selected = selectedCategory === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled || selectedCategory !== null}
                    aria-pressed={selected}
                    className={selected ? "discovery-detail-category-selected" : undefined}
                    onClick={() => selectCategory(key)}
                  >
                    <span>{label}</span>
                    {selected ? <Check className="discovery-detail-category-check size-3" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </> : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </form>
  );
}
