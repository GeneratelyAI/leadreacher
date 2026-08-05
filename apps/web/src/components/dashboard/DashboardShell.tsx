"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Clock3,
  Ellipsis,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  MessageSquare,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  Users,
  Video,
  X,
  BarChart3,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, clearAccessTokenCache } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useThemeMode } from "@/hooks/useThemeMode";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/prospects", label: "Prospects", icon: Users },
  { href: "/dashboard/messages", label: "Chat", icon: MessageSquare },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/activity", label: "Activity", icon: Clock3 },
  { href: "/dashboard/channels", label: "Channels", icon: Link2 },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const NAVIGATION: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

function navItemActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type ShellOverview = {
  organization: { name: string; plan: string };
  engine: { status: "running" | "ready" | "needs_attention"; label: string; detail: string };
  unreadNotificationCount: number;
  channels: Array<{ id: string; platform: string; accountName: string; status: string }>;
  activity: ShellActivity[];
};

type ShellActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: string;
  avatarUrl?: string | null;
  channel?: string;
  action?: "reply" | "view";
  href?: string;
};

type SearchResults = {
  prospects: Array<{ id: string; name: string; company: string; avatarUrl: string | null }>;
  campaigns: Array<{ id: string; name: string; status: string }>;
};

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "W";
}

function dateParam(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function readableRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "Last 7 days";
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${format.format(start)} - ${format.format(end)}`;
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ShellActivityIcon({ kind }: { kind: ShellActivity["kind"] }) {
  const Icon = kind === "message" ? MessageSquare : kind === "prospect" ? Users : kind === "video" ? Video : Megaphone;
  return <Icon className="size-4" aria-hidden />;
}

function WorkspaceSidebar({
  pathname,
  memberName,
  overview,
  collapsed = false,
  onSignOut,
  onPrefetch,
}: {
  pathname: string;
  memberName: string;
  overview: ShellOverview | null;
  collapsed?: boolean;
  onSignOut: () => void;
  onPrefetch: (href: string) => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-app-border bg-app-chrome py-5",
        collapsed ? "items-center px-2" : "px-4",
      )}
      aria-label="Workspace sidebar"
    >
      <div className={cn("flex w-full items-center", collapsed ? "justify-center" : "justify-between")}>
        <Link
          href="/dashboard"
          className="inline-flex min-w-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
          aria-label="LeadReacher overview"
        >
          {collapsed ? (
            <OnboardingLogo markOnly className="h-5 w-auto translate-x-1" />
          ) : (
            <OnboardingLogo className="h-auto w-[15rem] max-w-full" />
          )}
        </Link>
      </div>

      <nav className={cn("w-full", collapsed ? "mt-10" : "mt-10 space-y-1")} aria-label="Workspace navigation">
        {NAVIGATION.map(({ href, label, icon: Icon, exact }) => {
          const active = navItemActive(pathname, { href, label, icon: Icon, exact });
          const link = (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => onPrefetch(href)}
              onFocus={() => onPrefetch(href)}
              className={cn(
                "group flex h-10 items-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                collapsed ? "mb-1 justify-center px-0" : "gap-3 px-3.5",
                active
                  ? "bg-onboarding-purple-50 font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                  : "text-app-fg-muted hover:bg-app-hover dark:text-onboarding-neutral-300",
              )}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right" align="center" sideOffset={12}>
                {label}
              </TooltipContent>
            </Tooltip>
          ) : link;
        })}
      </nav>

      <button
        type="button"
        className={cn(
          "mt-auto flex h-9 items-center rounded-lg text-left text-sm text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300",
          collapsed ? "w-10 justify-center px-0" : "w-full gap-3 px-3.5",
        )}
        aria-label="Help center"
      >
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        {!collapsed ? "Help center" : null}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "mt-3 flex items-center rounded-lg transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                collapsed ? "size-10 justify-center px-0" : "w-full gap-3 px-2 py-2.5",
              )}
              aria-label={`${memberName} account`}
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-onboarding-purple-50 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">{initials(memberName)}</span>
              {!collapsed ? (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{memberName}</span>
                  <span className="block truncate text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{overview?.organization.plan ?? "Starter"}</span>
                </span>
              ) : null}
              {!collapsed ? <ChevronDown className="size-4 shrink-0 text-onboarding-neutral-400" aria-hidden /> : null}
            </button>
          }
        />
        <DropdownMenuContent
          side="top"
          align={collapsed ? "start" : "end"}
          sideOffset={8}
          className="w-60 border border-app-border bg-app-elevated p-1.5 text-app-fg shadow-onboarding-button"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{memberName}</p>
              <p className="truncate text-xs font-normal text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{overview?.organization.plan ?? "Starter"} plan</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="my-1 bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750" />
          <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"><Settings className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />Settings</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"><CreditCard className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />Billing</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/activity" />} className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"><Bell className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />Notifications</DropdownMenuItem>
          <DropdownMenuSeparator className="my-1 bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750" />
          <DropdownMenuItem onClick={() => void onSignOut()} className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"><LogOut className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { isDark, toggle } = useThemeMode();
  const { data: overview = null } = useQuery({
    queryKey: ["dashboard", "chrome"],
    queryFn: () => apiFetch<ShellOverview>("/dashboard/chrome"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAccessTokenCache();
    router.replace("/login");
    router.refresh();
  }

  const prefetchWorkspace = useCallback((href: string) => {
    router.prefetch(href);
    const request = href === "/dashboard"
      ? { key: ["dashboard", "overview", ""], url: "/dashboard/overview" }
      : href === "/dashboard/campaigns"
        ? { key: ["dashboard", "campaigns", "status=all"], url: "/dashboard/campaigns?status=all" }
        : href === "/dashboard/prospects"
          ? { key: ["dashboard", "prospects", "limit=10&offset=0"], url: "/dashboard/prospects?limit=10&offset=0" }
          : href === "/dashboard/messages"
            ? { key: ["dashboard", "conversations", "state=all&limit=20&offset=0"], url: "/dashboard/conversations?state=all&limit=20&offset=0" }
            : href === "/dashboard/activity"
              ? { key: ["dashboard", "activity", "kind=all&limit=20&offset=0"], url: "/dashboard/activity?kind=all&limit=20&offset=0" }
              : href === "/dashboard/channels"
                ? { key: ["dashboard", "channels", ""], url: "/social-accounts" }
                : href === "/dashboard/analytics"
                  ? { key: ["dashboard", "analytics", "granularity=day"], url: "/dashboard/analytics?granularity=day" }
                  : href === "/dashboard/settings"
                    ? { key: ["dashboard", "settings"], url: "/dashboard/settings" }
                    : null;
    if (!request) return;
    void queryClient.prefetchQuery({
      queryKey: request.key,
      queryFn: () => apiFetch(request.url),
      staleTime: 30_000,
    });
  }, [queryClient, router]);

  useEffect(() => {
    const savedState = window.localStorage.getItem("leadreacher-sidebar-open");
    if (savedState === "false") setSidebarOpen(false);
  }, []);

  useEffect(() => {
    function handleSidebarKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen((current) => {
          const next = !current;
          window.localStorage.setItem("leadreacher-sidebar-open", String(next));
          return next;
        });
      }
      if (event.key === "Escape") setMobileSidebarOpen(false);
    }

    window.addEventListener("keydown", handleSidebarKeyboard);
    return () => window.removeEventListener("keydown", handleSidebarKeyboard);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  function toggleDesktopSidebar() {
    setSidebarOpen((current) => {
      const next = !current;
      window.localStorage.setItem("leadreacher-sidebar-open", String(next));
      return next;
    });
  }

  useEffect(() => {
    if (!searchOpen) {
      setResults(null);
      return;
    }
    const normalized = search.trim();
    if (normalized.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void apiFetch<SearchResults>(`/dashboard/search?query=${encodeURIComponent(normalized)}`)
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults(null);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setSearch("");
    setResults(null);
  }

  const pageRange = readableRange(searchParams.get("startDate"), searchParams.get("endDate"));
  const showRangeControl =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/activity") ||
    pathname.startsWith("/dashboard/channels") ||
    pathname.startsWith("/dashboard/analytics");
  const secondaryActive = SECONDARY_NAV.some((item) => navItemActive(pathname, item));

  function setRange(days: number) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const params = new URLSearchParams(searchParams.toString());
    params.set("startDate", dateParam(start));
    params.set("endDate", dateParam(end));
    const basePath = pathname.startsWith("/dashboard/activity")
      ? "/dashboard/activity"
      : pathname.startsWith("/dashboard/channels")
        ? "/dashboard/channels"
        : pathname.startsWith("/dashboard/analytics")
          ? "/dashboard/analytics"
          : "/dashboard";
    router.replace(`${basePath}?${params.toString()}`);
  }

  return (
    <TooltipProvider>
      <div
        className="dashboard-shell h-dvh overflow-hidden bg-app-canvas text-app-fg"
        style={{
          // Used by floating workspace chrome (e.g. prospect selection bar) to center in the main pane.
          ["--dashboard-sidebar-width" as string]: sidebarOpen ? "17.75rem" : "4.5rem",
          ["--dashboard-page-px" as string]: sidebarOpen ? "1rem" : "0.75rem",
          ["--dashboard-page-py" as string]: sidebarOpen ? "1.25rem" : "1rem",
          ["--dashboard-bottom-nav-height" as string]: "calc(3.75rem + var(--safe-area-bottom))",
        }}
      >
      <div className="flex h-full w-full">
        <div className={cn("relative hidden h-full shrink-0 transition-[width] duration-200 ease-out lg:block", sidebarOpen ? "w-[17.75rem]" : "w-[4.5rem]")}>
          <WorkspaceSidebar pathname={pathname} memberName={memberName} overview={overview} collapsed={!sidebarOpen} onSignOut={handleSignOut} onPrefetch={prefetchWorkspace} />
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="top"
            showCloseButton={false}
            className="max-h-[min(85dvh,40rem)] gap-0 overflow-y-auto rounded-b-2xl border-app-border bg-app-chrome p-0 shadow-lg lg:hidden"
          >
            <SheetHeader className="flex flex-row items-center justify-between gap-3 border-b border-app-border px-4 py-3 text-left">
              <div className="min-w-0">
                <SheetTitle className="text-base">Menu</SheetTitle>
                <SheetDescription className="text-xs">Jump to a workspace destination</SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-500 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </SheetHeader>

            <nav className="grid grid-cols-2 gap-1.5 p-3" aria-label="Workspace navigation">
              {NAVIGATION.map((item) => {
                const active = navItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                      active
                        ? "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                        : "text-app-fg hover:bg-app-hover",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-1 border-t border-app-border p-3 pb-[max(0.75rem,var(--safe-area-bottom))]">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300"
                aria-label="Help center"
              >
                <CircleHelp className="size-5 shrink-0" aria-hidden />
                Help center
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
                      aria-label={`${memberName} account`}
                    />
                  }
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-onboarding-purple-50 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
                    {initials(memberName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{memberName}</span>
                    <span className="block truncate text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                      {overview?.organization.plan ?? "Starter"}
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-onboarding-neutral-400" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-60 border border-app-border bg-app-elevated p-1.5 text-app-fg shadow-onboarding-button"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{memberName}</p>
                      <p className="truncate text-xs font-normal text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                        {overview?.organization.plan ?? "Starter"} plan
                      </p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="my-1 bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750" />
                  <DropdownMenuItem
                    render={<Link href="/dashboard/settings" onClick={() => setMobileSidebarOpen(false)} />}
                    className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"
                  >
                    <Settings className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/dashboard/settings" onClick={() => setMobileSidebarOpen(false)} />}
                    className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"
                  >
                    <CreditCard className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/dashboard/activity" onClick={() => setMobileSidebarOpen(false)} />}
                    className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"
                  >
                    <Bell className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750" />
                  <DropdownMenuItem
                    onClick={() => void handleSignOut()}
                    className="gap-3 rounded-lg px-3 py-2.5 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0"
                  >
                    <LogOut className="size-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400" aria-hidden />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="gap-0 rounded-t-2xl border-app-border bg-app-elevated pb-[max(1rem,var(--safe-area-bottom))] lg:hidden">
            <SheetHeader className="border-b border-app-border px-1 pb-3">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>Secondary workspace destinations.</SheetDescription>
            </SheetHeader>
            <nav className="grid gap-1 py-3" aria-label="More destinations">
              {SECONDARY_NAV.map((item) => {
                const active = navItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                      active
                        ? "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                        : "text-app-fg hover:bg-app-hover",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative flex min-h-[4.75rem] shrink-0 items-center border-b-0 lg:border-b border-app-border bg-app-chrome px-[var(--dashboard-page-px,1rem)] pt-[var(--safe-area-top)]">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="mr-1 inline-flex size-10 items-center justify-center rounded-lg text-onboarding-neutral-600 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 lg:hidden" aria-label="Open menu" aria-expanded={mobileSidebarOpen}><Menu className="size-5" aria-hidden /></button>
            <button type="button" onClick={toggleDesktopSidebar} className="mr-3 hidden size-9 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 lg:inline-flex" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen} title={sidebarOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}>{sidebarOpen ? <PanelLeftClose className="size-4" aria-hidden /> : <PanelLeftOpen className="size-4" aria-hidden />}</button>
            <div className="relative hidden min-w-0 w-full max-w-[29rem] flex-1 lg:block">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-full items-center rounded-lg border border-app-border bg-app-elevated pr-3 pl-10 text-left text-sm text-app-fg-subtle outline-none transition-colors hover:border-app-border-strong focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
                aria-label="Open search"
              >
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-onboarding-neutral-500" aria-hidden />
                <span className="truncate">Ask Leadreacher anything...</span>
                <kbd className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] font-medium text-onboarding-neutral-400">⌘ K</kbd>
              </button>
            </div>

            <Dialog open={searchOpen} onOpenChange={(open) => open ? setSearchOpen(true) : closeSearch()}>
              <DialogContent className="max-w-2xl p-0">
                <DialogHeader className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750">
                  <DialogTitle>Search workspace</DialogTitle>
                  <DialogDescription>Find prospects and campaigns by name or company.</DialogDescription>
                </DialogHeader>
                <div className="px-5 pb-5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-onboarding-neutral-500" aria-hidden />
                    <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prospects or campaigns..." className="h-11 pl-9 pr-10" aria-label="Search prospects and campaigns" />
                    {search ? <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-2.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-onboarding-neutral-400 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300" aria-label="Clear search"><X className="size-3.5" /></button> : null}
                  </div>
                  <div className="mt-4 max-h-[22rem] overflow-y-auto">
                    {search.trim().length < 2 ? <p className="py-8 text-center text-sm text-onboarding-neutral-500">Type at least two characters to search.</p> : null}
                    {search.trim().length >= 2 && results && !results.prospects.length && !results.campaigns.length ? <p className="py-8 text-center text-sm text-onboarding-neutral-500">No matching prospects or campaigns.</p> : null}
                    {results?.prospects.length ? <div className="py-1"><p className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.1em] text-onboarding-neutral-500 uppercase">Prospects</p><div className="space-y-1">{results.prospects.map((prospect) => <Link key={prospect.id} href={`/dashboard/prospects/${prospect.id}`} onClick={closeSearch} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-onboarding-neutral-50 focus-visible:bg-onboarding-neutral-50 focus-visible:outline-none dark:hover:bg-app-hover dark:focus-visible:bg-onboarding-neutral-800"><span className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full bg-onboarding-purple-50 text-[10px] font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">{prospect.avatarUrl ? <img src={prospect.avatarUrl} alt="" className="size-full object-cover" /> : initials(prospect.name)}</span><span className="min-w-0"><span className="block truncate font-medium">{prospect.name}</span><span className="block truncate text-xs text-onboarding-neutral-500">{prospect.company}</span></span></Link>)}</div></div> : null}
                    {results?.campaigns.length ? <div className="mt-2 border-t border-onboarding-neutral-150 py-3 dark:border-onboarding-neutral-750"><p className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.1em] text-onboarding-neutral-500 uppercase">Campaigns</p><div className="space-y-1">{results.campaigns.map((campaign) => <Link key={campaign.id} href={`/dashboard/campaigns?reviewCampaignId=${encodeURIComponent(campaign.id)}`} onClick={closeSearch} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-onboarding-neutral-50 focus-visible:bg-onboarding-neutral-50 focus-visible:outline-none dark:hover:bg-app-hover dark:focus-visible:bg-onboarding-neutral-800"><Megaphone className="size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" /><span className="min-w-0"><span className="block truncate font-medium">{campaign.name}</span><span className="block text-xs text-onboarding-neutral-500">{campaign.status}</span></span></Link>)}</div></div> : null}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 lg:hidden"
                aria-label="Open search"
              >
                <Search className="size-[1.05rem]" aria-hidden />
              </button>
              {showRangeControl ? (
                <div className="hidden sm:block">
                  <Select onValueChange={(value) => setRange(Number(value))}>
                    <SelectTrigger aria-label="Date range" className="h-10 w-auto max-w-[11rem] gap-2 border-onboarding-neutral-150 px-3 text-sm font-medium text-onboarding-ink hover:bg-onboarding-neutral-50 dark:border-onboarding-neutral-750 dark:text-onboarding-neutral-0 dark:hover:bg-app-hover">
                      <CalendarDays className="size-4 shrink-0 text-onboarding-neutral-600 dark:text-onboarding-neutral-300" aria-hidden />
                      <span className="truncate">{pageRange}</span>
                    </SelectTrigger>
                    <SelectContent align="end" className="w-44 border border-app-border bg-app-elevated text-app-fg">
                      {RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)} className="px-3 py-2 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button type="button" className="relative inline-flex size-10 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300" aria-label={`${overview?.unreadNotificationCount ?? 0} unread replies`}>
                      <Bell className="size-[1.05rem]" aria-hidden />
                      {overview?.unreadNotificationCount ? <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-onboarding-purple-600 px-1 text-[10px] font-semibold leading-4 text-white">{overview.unreadNotificationCount > 9 ? "9+" : overview.unreadNotificationCount}</span> : null}
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] border border-app-border bg-app-elevated p-1.5 text-app-fg shadow-onboarding-button">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Recent activity</DropdownMenuLabel>
                    {overview?.activity?.length ? overview.activity.slice(0, 5).map((item) => (
                      <DropdownMenuItem key={item.id} render={<Link href={item.href ?? "/dashboard/activity"} />} className="items-start gap-3 rounded-lg px-3 py-2.5 text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200"><ShellActivityIcon kind={item.kind} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{item.detail}</span>
                        </span>
                        <time className="shrink-0 pt-0.5 text-[11px] text-onboarding-neutral-500 dark:text-onboarding-neutral-400" dateTime={item.occurredAt}>{relativeTime(item.occurredAt)}</time>
                      </DropdownMenuItem>
                    )) : <DropdownMenuItem disabled className="px-3 py-3 text-sm text-onboarding-neutral-500">No recent activity</DropdownMenuItem>}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="my-1 bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750" />
                  <DropdownMenuItem render={<Link href="/dashboard/activity" />} className="justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-onboarding-purple-600 focus:bg-onboarding-purple-50 focus:text-onboarding-purple-700 dark:text-onboarding-purple-200 dark:focus:bg-onboarding-purple-500/15 dark:focus:text-onboarding-purple-100">
                    View all activity <ArrowRight className="size-3.5" aria-hidden />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" onClick={(event) => toggle(event)} className="inline-flex size-10 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>{isDark ? <Sun className="size-[1.1rem]" aria-hidden /> : <Moon className="size-[1.1rem]" aria-hidden />}</button>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[var(--dashboard-bottom-nav-height)] lg:pb-0">{children}</main>
          {modal}

          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t-0 bg-app-chrome/95 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] pb-[var(--safe-area-bottom)] backdrop-blur-md lg:hidden"
            aria-label="Primary destinations"
          >
            <ul className="grid h-[3.75rem] grid-cols-5">
              {PRIMARY_NAV.map((item) => {
                const active = navItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-onboarding-purple-300",
                        active
                          ? "text-onboarding-purple-600 dark:text-onboarding-purple-200"
                          : "text-onboarding-neutral-500 hover:text-onboarding-neutral-800 dark:text-onboarding-neutral-400 dark:hover:text-onboarding-neutral-200",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-5" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-onboarding-purple-300",
                    secondaryActive || moreOpen
                      ? "text-onboarding-purple-600 dark:text-onboarding-purple-200"
                      : "text-onboarding-neutral-500 hover:text-onboarding-neutral-800 dark:text-onboarding-neutral-400 dark:hover:text-onboarding-neutral-200",
                  )}
                  aria-expanded={moreOpen}
                  aria-label="More destinations"
                >
                  <Ellipsis className="size-5" aria-hidden />
                  <span>More</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
