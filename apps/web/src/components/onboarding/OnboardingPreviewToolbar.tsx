"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, STRATEGY_SUBSTEPS } from "./steps/steps";

export function OnboardingPreviewToolbar() {
  const params = useSearchParams();
  const activeStep = params.get("step") ?? "strategy";
  const activeSubstep = params.get("substep");

  return (
    <details
      aria-label="Onboarding preview controls"
      className="group fixed top-20 right-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/15 dark:bg-onboarding-neutral-900/95"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold uppercase tracking-wider text-onboarding-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-onboarding-purple-400 dark:text-onboarding-purple-200">
        Preview controls
      </summary>
      <nav className="flex max-w-[calc(100vw-1.5rem)] items-center gap-2 overflow-x-auto border-t border-black/10 p-2 dark:border-white/15">
        {ONBOARDING_STEPS.map((step) => (
          <Link
            key={step.value}
            href={`/onboarding-preview?step=${step.value}`}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeStep === step.value ? "bg-onboarding-purple-600 text-white" : "text-onboarding-neutral-700 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-200 dark:hover:bg-white/10"}`}
          >
            {step.label}
          </Link>
        ))}
        {activeStep === "strategy" ? (
          <div className="flex shrink-0 gap-1 border-l border-black/10 pl-2 dark:border-white/15">
            {STRATEGY_SUBSTEPS.map((substep) => (
              <Link
                key={substep}
                href={`/onboarding-preview?step=strategy&substep=${substep}`}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium capitalize ${activeSubstep === substep ? "bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100" : "text-onboarding-neutral-600 dark:text-onboarding-neutral-300"}`}
              >
                {substep.replaceAll("-", " ")}
              </Link>
            ))}
          </div>
        ) : null}
      </nav>
    </details>
  );
}
