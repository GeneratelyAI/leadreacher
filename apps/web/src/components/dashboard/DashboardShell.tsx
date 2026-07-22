"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  Link2,
  Megaphone,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { useThemeMode } from "@/hooks/useThemeMode";
import { cn } from "@/lib/utils";

const NAVIGATION: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/prospects", label: "Prospects", icon: Users },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/activity", label: "Activity", icon: Clock3 },
  { href: "/dashboard/channels", label: "Channels", icon: Link2 },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardShell({
  memberName,
  children,
  modal,
}: {
  memberName: string;
  children: ReactNode;
  modal?: ReactNode;
}) {
  const pathname = usePathname();
  const { isDark, toggle } = useThemeMode();

  return (
    <div className="h-dvh overflow-hidden bg-onboarding-neutral-0 text-onboarding-ink dark:bg-onboarding-neutral-950 dark:text-onboarding-neutral-0">
      <div className="flex h-full w-full">
        <aside className="hidden h-full w-[17.5rem] shrink-0 border-r border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 py-7 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 lg:flex lg:flex-col">
          <OnboardingLogo className="h-8 w-auto" />
          <p className="mt-1 pl-9 text-[10px] font-medium tracking-[0.14em] text-onboarding-neutral-400 uppercase dark:text-onboarding-neutral-500">AI customer acquisition</p>
          <nav className="mt-11 space-y-1.5" aria-label="Workspace navigation">
            {NAVIGATION.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-onboarding px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                    active
                      ? "bg-onboarding-purple-50 font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                      : "text-onboarding-neutral-500 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link href="/dashboard/settings" className="mt-auto flex w-full items-center gap-3 rounded-onboarding px-2 py-2 text-left text-sm transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:hover:bg-onboarding-neutral-800">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-onboarding-neutral-150 font-semibold text-onboarding-purple-600 dark:bg-onboarding-neutral-750 dark:text-onboarding-purple-200">{memberName.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{memberName}</span>
            <ChevronDown className="size-4 text-onboarding-neutral-400" aria-hidden />
          </Link>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-[4.75rem] shrink-0 items-center justify-between border-b border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 sm:px-7 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <OnboardingLogo className="h-6 w-auto" />
              <span className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Workspace</span>
            </div>
            <div className="hidden max-w-[29rem] flex-1 lg:block">
              <div className="flex h-10 items-center gap-2.5 rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-50 px-3.5 text-sm text-onboarding-neutral-400 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-500">
                <Search className="size-4" aria-hidden />
                Search coming soon
                <span className="ml-auto rounded border border-onboarding-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-onboarding-neutral-400 dark:border-onboarding-neutral-700">⌘ K</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button type="button" onClick={(event) => toggle(event.currentTarget)} className="inline-flex size-10 items-center justify-center rounded-onboarding text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
                {isDark ? <Sun className="size-[1.1rem]" aria-hidden /> : <Moon className="size-[1.1rem]" aria-hidden />}
              </button>
              <span className="hidden size-10 items-center justify-center text-onboarding-neutral-400 sm:inline-flex" aria-label="Notifications coming soon"><Bell className="size-4" aria-hidden /></span>
            </div>
          </header>
          <main className={cn(
            "min-h-0 flex-1 overscroll-contain",
            pathname === "/dashboard" ? "overflow-y-auto lg:overflow-hidden" : "overflow-y-auto",
          )}>{children}</main>
          {modal}
        </div>
      </div>
    </div>
  );
}
