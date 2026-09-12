"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ONBOARDING_ROUTES, type OnboardingRouteId } from "./navigation";
import { MOBILE_REFERENCE_STATES, type MobileReferenceId } from "./mobile-reference";
import {
  previewMobileReferenceHref,
  previewRouteHref,
  previewSelection,
} from "./preview-navigation";
import styles from "../components/Preview.module.css";

/** Internal toolbar for URL-addressable visual fixtures. It never owns campaign state. */
export function Preview() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { route: activeRoute, reference } = previewSelection(params, pathname);
  const activeReference = reference?.id ?? "";
  const authReference = reference?.route === "signup" || reference?.route === "login" ? reference.route : null;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  function navigate(href: string) {
    if (href !== `${window.location.pathname}${window.location.search}`) {
      router.push(href, { scroll: false });
    }
  }

  async function copyPreviewLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  // Screenshot fixtures omit developer chrome only, never customer controls.
  if (params.get("capture") === "1") return null;

  return (
    <aside
      aria-label="Onboarding preview controls"
      className={styles.controls}
      data-open={open}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          toggle.current?.focus({ preventScroll: true });
        }
      }}
    >
      <button
        type="button"
        ref={toggle}
        className={styles.summary}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span>Preview controls</span>
        <span className={styles.summaryHint} aria-hidden>{open ? "Close −" : "Open +"}</span>
      </button>
      <div id={panelId} className={styles.panel} inert={!open} aria-hidden={!open}>
        <div className={styles.panelInner}>
          <div className={styles.group}>
            <label htmlFor="preview-step">Onboarding step</label>
            <select
              id="preview-step"
              value={authReference ?? activeRoute}
              onChange={(event) => navigate(previewRouteHref(params, event.target.value as OnboardingRouteId))}
            >
              {authReference ? <option value={authReference} disabled>{authReference === "signup" ? "Signup" : "Login"} reference</option> : null}
              {ONBOARDING_ROUTES.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}
            </select>
          </div>
          <div className={styles.group}>
            <label htmlFor="preview-mobile-reference">Mobile reference state</label>
            <select
              id="preview-mobile-reference"
              value={activeReference}
              onChange={(event) => {
                navigate(previewMobileReferenceHref(event.target.value as MobileReferenceId | ""));
              }}
            >
              <option value="">No mobile reference</option>
              {MOBILE_REFERENCE_STATES.map((state) => <option key={state.id} value={state.id}>{state.id} · {state.name}</option>)}
            </select>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={copyPreviewLink}>Copy preview link</button>
            <span className={styles.copyStatus} role="status" aria-live="polite">{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : ""}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
