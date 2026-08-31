"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LayoutDashboard, RefreshCw, ShieldCheck, Sparkles } from "@/components/ui/icons";
import { useEffect, useState } from "react";
import { ThemeToggleButton } from "@/components/onboarding/AccountControls";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_STRATEGY } from "@/lib/onboarding/demo-fixtures";
import { DEMO_STORAGE_KEY, readDemoState, type DemoOnboardingState } from "@/lib/onboarding/demo-store";

const CAMPAIGN_LABELS = {
  ai_video_ad: "Instant Ad",
  personalized_outreach: "Personalized Ad",
  uploaded_video: "Upload Video",
  build_from_file_demo: "Build From a File",
} as const;

export default function DemoDashboard() {
  const router = useRouter();
  const [state, setState] = useState<DemoOnboardingState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readDemoState(window.sessionStorage);
    setState(stored);
    setLoaded(true);
    if (!stored?.completed) router.replace("/demo/onboarding?step=signup");
  }, [router]);

  function restart() {
    window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
    router.push("/");
  }

  if (!loaded || !state?.completed) return null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-20 items-center justify-between border-b border-border px-5 sm:px-8">
        <Link href="/" aria-label="LeadReacher home"><OnboardingLogo className="h-7 w-auto" /></Link>
        <div className="flex items-center gap-2"><StatusBadge tone="brand">Demo workspace</StatusBadge><ThemeToggleButton /></div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold tracking-[0.16em] text-onboarding-purple-600 uppercase dark:text-onboarding-purple-200">Demo complete</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-onboarding-ink dark:text-white sm:text-4xl">Your sample campaign workspace</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-onboarding-neutral-500">You completed the LeadReacher journey without creating an account, connecting an external service, or sending outreach.</p></div>
          <div className="flex gap-2"><Button variant="secondary" onClick={restart}><RefreshCw aria-hidden />Restart demo</Button><Button asChild><Link href="/signup">Create a real workspace<ArrowRight aria-hidden /></Link></Button></div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <OnboardingCard className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900/40 dark:text-onboarding-purple-100"><LayoutDashboard className="size-5" aria-hidden /></span><StatusBadge tone="success"><Check className="size-3" />Ready for review</StatusBadge></div>
            <p className="mt-6 text-xs font-semibold tracking-wide text-onboarding-purple-600 uppercase dark:text-onboarding-purple-200">Sample campaign</p>
            <h2 className="mt-2 text-2xl font-semibold text-onboarding-ink dark:text-white">{state?.campaignType ? CAMPAIGN_LABELS[state.campaignType] : "Personalized Ad"}</h2>
            <p className="mt-3 text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-300">{DEMO_STRATEGY.valueProposition}</p>
            <div className="mt-6 flex flex-wrap gap-2">{DEMO_STRATEGY.roles.map((role) => <span key={role} className="rounded-full bg-onboarding-neutral-100 px-3 py-1.5 text-sm dark:bg-onboarding-neutral-800">{role}</span>)}</div>
          </OnboardingCard>

          <div className="grid gap-5">
            <OnboardingCard className="p-6"><div className="flex items-center gap-3"><Sparkles className="size-5 text-onboarding-purple-600" aria-hidden /><h2 className="font-semibold text-onboarding-ink dark:text-white">Demo connections</h2></div><ul className="mt-4 space-y-3 text-sm">{state?.connections.length ? state.connections.map((connection) => <li key={connection} className="flex items-center gap-2 capitalize"><Check className="size-4 text-onboarding-success-500" aria-hidden />{connection} demo connected</li>) : <li className="text-onboarding-neutral-500">Connections were skipped</li>}</ul></OnboardingCard>
            <OnboardingCard className="p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-onboarding-success-500" aria-hidden /><div><h2 className="font-semibold text-onboarding-ink dark:text-white">Nothing was sent</h2><p className="mt-2 text-sm leading-6 text-onboarding-neutral-500">Real prospects, connections, payments, and outreach are available only after you create a real workspace.</p></div></div></OnboardingCard>
          </div>
        </div>
      </main>
    </div>
  );
}
