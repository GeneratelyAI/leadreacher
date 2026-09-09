"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, STRATEGY_SUBSTEPS } from "./navigation";
import { MOBILE_REFERENCE_STATES } from "@/features/onboarding/state/mobile-reference";
import {
  previewMobileReferenceHref,
  previewStepHref,
  previewStrategyHref,
} from "./preview-navigation";
import styles from "../components/Preview.module.css";

/** Internal toolbar for URL-addressable visual fixtures. It never owns campaign state. */
export function Preview() {
  const params = useSearchParams();
  const router = useRouter();
  const activeStep = params.get("step") ?? "strategy";
  const activeSubstep = params.get("substep") ?? "how-it-works";
  const activeReference = params.get("screen") ?? "";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  function navigate(href: string) {
    router.push(href);
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
    <details aria-label="Onboarding preview controls" className={styles.controls}>
      <summary className={styles.summary}>
        <span>Preview controls</span>
        <span className={styles.summaryHint} aria-hidden>Open</span>
      </summary>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.group}>
            <label htmlFor="preview-step">Onboarding step</label>
            <select
              id="preview-step"
              value={activeStep}
              onChange={(event) => navigate(previewStepHref(params, event.target.value as typeof ONBOARDING_STEPS[number]["value"]))}
            >
              {ONBOARDING_STEPS.map((step) => <option key={step.value} value={step.value}>{step.label}</option>)}
            </select>
          </div>
          {activeStep === "strategy" ? (
            <div className={styles.group} aria-label="Strategy substep">
              <span className={styles.groupLabel}>Strategy substep</span>
              <div className={styles.segmented}>
                {STRATEGY_SUBSTEPS.map((substep) => (
                  <button
                    type="button"
                    key={substep}
                    aria-current={activeSubstep === substep ? "page" : undefined}
                    onClick={() => navigate(previewStrategyHref(params, substep))}
                  >
                    {substep.replaceAll("-", " ")}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className={styles.group}>
            <label htmlFor="preview-mobile-reference">Mobile reference state</label>
            <select
              id="preview-mobile-reference"
              value={activeReference}
              onChange={(event) => {
                if (event.target.value) navigate(previewMobileReferenceHref(event.target.value as typeof MOBILE_REFERENCE_STATES[number]["id"]));
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
    </details>
  );
}
