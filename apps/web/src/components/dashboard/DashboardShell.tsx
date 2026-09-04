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
  IconContext,
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
} from "@/components/ui/icons";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { formatSocialMediaNames } from "@/components/dashboard/ChannelIdentity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "@/components/dashboard/Filter";
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
import { CommandPalette, type CommandPaletteGroup } from "@/components/ui/command-palette";
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

const DashboardShellContext = createContext<{ memberName: string; canExportData: boolean } | null>(null);

export function useDashboardShell() {
  const context = useContext(DashboardShellContext);
  if (!context) throw new Error("useDashboardShell must be used within DashboardShell");
  return context;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/prospects", label: "Prospects", icon: Users },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
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

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
              <Icon weight={label === "Channels" ? "bold" : "fill"} className="size-4 shrink-0" aria-hidden />
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
  canExportData,
  children,
  modal,
}: {
  memberName: string;
  canExportData: boolean;
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
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    return params.toString();
  }, [searchParams]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAccessTokenCache();
    router.replace("/login");
    router.refresh();
  }

  const prefetchWorkspace = useCallback((href: string) => {
    router.prefetch(href);
    const withRange = (path: string) => `${path}?${rangeQuery}`;

    if (href === "/dashboard") {
      void Promise.all([
        queryClient.prefetchQuery({ queryKey: ["dashboard", "overview", rangeQuery], queryFn: () => apiFetch(withRange("/dashboard/overview")) }),
        queryClient.prefetchQuery({ queryKey: ["dashboard", "analytics", rangeQuery], queryFn: () => apiFetch(withRange("/dashboard/analytics")) }),
      ]);
      return;
    }
    if (href === "/dashboard/campaigns") {
      void Promise.all([
        queryClient.prefetchQuery({ queryKey: ["dashboard", "campaigns", "status=all"], queryFn: () => apiFetch("/dashboard/campaigns?status=all") }),
        queryClient.prefetchQuery({ queryKey: ["social-accounts"], queryFn: () => apiFetch("/social-accounts") }),
      ]);
      return;
    }
    if (href === "/dashboard/prospects") {
      void Promise.all([
        queryClient.prefetchQuery({ queryKey: ["dashboard", "prospects", "limit=10&offset=0"], queryFn: () => apiFetch("/dashboard/prospects?limit=10&offset=0") }),
        queryClient.prefetchQuery({ queryKey: ["campaigns", "options"], queryFn: () => apiFetch("/campaigns") }),
      ]);
      return;
    }
    if (href === "/dashboard/messages") {
      const conversationParams = "state=all&limit=25";
      const conversationKey = ["dashboard", "conversations", conversationParams] as const;
      void queryClient.prefetchInfiniteQuery({
        queryKey: conversationKey,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => apiFetch<{ conversations: Array<{ id: string }>; offset: number; limit: number; total: number }>(`/dashboard/conversations?${conversationParams}&offset=${pageParam}`),
        getNextPageParam: (lastPage: { offset: number; limit: number; total: number }) => {
          const nextOffset = lastPage.offset + lastPage.limit;
          return nextOffset < lastPage.total ? nextOffset : undefined;
        },
      }).then(() => {
        const cached = queryClient.getQueryData<{ pages: Array<{ conversations: Array<{ id: string }> }> }>(conversationKey);
        const conversationId = cached?.pages[0]?.conversations[0]?.id;
        if (!conversationId) return;
        void queryClient.prefetchQuery({
          queryKey: ["dashboard", "conversation", conversationId],
          queryFn: () => apiFetch(`/dashboard/conversations/${conversationId}`),
        });
      });
      void queryClient.prefetchQuery({ queryKey: ["campaigns", "options"], queryFn: () => apiFetch("/campaigns") });
      return;
    }
    if (href === "/dashboard/activity") {
      void queryClient.prefetchQuery({ queryKey: ["dashboard", "activity", "kind=all&limit=10&offset=0"], queryFn: () => apiFetch("/dashboard/activity?kind=all&limit=10&offset=0") });
      return;
    }
    if (href === "/dashboard/channels") {
      void queryClient.prefetchQuery({ queryKey: ["dashboard", "channels", rangeQuery], queryFn: () => apiFetch(withRange("/social-accounts")) });
      return;
    }
    if (href === "/dashboard/analytics") {
      const analyticsParams = rangeQuery ? `granularity=day&${rangeQuery}` : "granularity=day";
      void Promise.all([
        queryClient.prefetchQuery({ queryKey: ["dashboard", "analytics", analyticsParams], queryFn: () => apiFetch(`/dashboard/analytics?${analyticsParams}`) }),
        queryClient.prefetchQuery({ queryKey: ["dashboard", "analytics-insights"], queryFn: () => apiFetch("/dashboard/analytics/insights") }),
      ]);
      return;
    }
    if (href === "/dashboard/settings") {
      const prefetches = [
        queryClient.prefetchQuery({ queryKey: ["dashboard", "settings"], queryFn: () => apiFetch("/dashboard/settings") }),
        queryClient.prefetchQuery({ queryKey: ["social-accounts"], queryFn: () => apiFetch("/social-accounts") }),
      ];
      if (canExportData) {
        prefetches.push(queryClient.prefetchQuery({ queryKey: ["dashboard", "settings", "exports"], queryFn: () => apiFetch("/dashboard/exports") }));
      }
      void Promise.all(prefetches);
    }
  }, [canExportData, queryClient, rangeQuery, router]);

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
      setIsSearching(false);
      return;
    }
    const normalized = search.trim();
    if (normalized.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      void apiFetch<SearchResults>(`/dashboard/search?query=${encodeURIComponent(normalized)}`)
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults(null);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
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
    setIsSearching(false);
  }

  const commandGroups = useMemo((): CommandPaletteGroup[] => {
    const navigation = NAVIGATION.map(({ href, label, icon }) => ({
      id: `navigate-${href}`,
      title: label,
      description: `Open ${label.toLocaleLowerCase()}`,
      icon,
      keywords: ["navigate", "go", href],
      onSelect: () => {
        closeSearch();
        router.push(href);
      },
    }));
    const groups: CommandPaletteGroup[] = [
      { id: "navigation", label: "Navigate", items: navigation },
      {
        id: "actions",
        label: "Actions",
        items: [
          {
            id: "toggle-theme",
            title: isDark ? "Use light appearance" : "Use dark appearance",
            description: "Change dashboard appearance",
            icon: isDark ? Sun : Moon,
            keywords: ["theme", "appearance", "dark", "light"],
            onSelect: () => {
              toggle();
              closeSearch();
            },
          },
          {
            id: "open-activity",
            title: "Open recent activity",
            description: "Review delivery, reply, and campaign events",
            icon: Clock3,
            keywords: ["notifications", "events", "updates"],
            onSelect: () => {
              closeSearch();
              router.push("/dashboard/activity");
            },
          },
        ],
      },
    ];
    if (results?.prospects.length) {
      groups.push({
        id: "prospects",
        label: "Prospects",
        items: results.prospects.map((prospect) => ({
          id: `prospect-${prospect.id}`,
          title: prospect.name,
          description: prospect.company || "Prospect",
          icon: Users,
          keywords: ["prospect", prospect.company],
          onSelect: () => {
            closeSearch();
            router.push(`/dashboard/prospects/${prospect.id}`);
          },
        })),
      });
    }
    if (results?.campaigns.length) {
      groups.push({
        id: "campaigns",
        label: "Campaigns",
        items: results.campaigns.map((campaign) => ({
          id: `campaign-${campaign.id}`,
          title: formatSocialMediaNames(campaign.name),
          description: titleCase(campaign.status),
          icon: Megaphone,
          keywords: ["campaign", campaign.status],
          onSelect: () => {
            closeSearch();
            router.push(`/dashboard/campaigns?reviewCampaignId=${encodeURIComponent(campaign.id)}`);
          },
        })),
      });
    }
    return groups;
  }, [isDark, results, router, toggle]);

  const pageRange = readableRange(searchParams.get("startDate"), searchParams.get("endDate"));
  const selectedRange = useMemo(() => {
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (!startDate || !endDate) return "7";
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    const days = Math.round((end - start) / 86_400_000) + 1;
    return RANGE_OPTIONS.some((option) => option.value === days) ? String(days) : "";
  }, [searchParams]);
  const showRangeControl =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/activity") ||
    pathname.startsWith("/dashboard/channels") ||
    pathname.startsWith("/dashboard/analytics");
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
      <IconContext.Provider value={{ weight: "fill" }}>
      <div
        className="dashboard-shell h-dvh overflow-hidden bg-app-canvas text-app-fg"
        style={{
          // Used by floating workspace chrome (e.g. prospect selection bar) to center in the main pane.
          ["--dashboard-sidebar-width" as string]: sidebarOpen ? "17.75rem" : "4.5rem",
          ["--dashboard-page-px" as string]: sidebarOpen ? "1rem" : "0.75rem",
          ["--dashboard-page-py" as string]: sidebarOpen ? "1.25rem" : "1rem",
        }}
      >
      <DashboardShellContext.Provider value={{ memberName, canExportData }}>
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
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-onboarding-neutral-500" weight="regular" aria-hidden />
                <span className="truncate">Ask Leadreacher anything...</span>
                <kbd className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] font-medium text-onboarding-neutral-400">⌘ K</kbd>
              </button>
            </div>

            <CommandPalette
              open={searchOpen}
              onOpenChange={(open) => open ? setSearchOpen(true) : closeSearch()}
              query={search}
              onQueryChange={setSearch}
              groups={commandGroups}
              isLoading={isSearching}
            />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 lg:hidden"
                aria-label="Open search"
              >
                <Search className="size-[1.05rem]" weight="regular" aria-hidden />
              </button>
              {showRangeControl ? (
                <div className="block">
                  <Filter
                    value={selectedRange}
                    groups={[{ label: "Date range", options: RANGE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label, icon: <CalendarDays className="size-5" aria-hidden /> })) }]}
                    onValueChange={(value) => setRange(Number(value))}
                    allLabel={pageRange}
                    allIcon={<CalendarDays className="size-4" aria-hidden />}
                    showAll={false}
                    aria-label="Date range"
                    className="h-10 w-10 min-w-0 gap-0 border-onboarding-neutral-150 px-0 text-sm font-medium hover:bg-onboarding-neutral-50 min-[430px]:w-auto min-[430px]:min-w-40 min-[430px]:gap-2 min-[430px]:px-3 dark:border-onboarding-neutral-750 dark:hover:bg-app-hover"
                    labelClassName="hidden min-[430px]:inline"
                    menuWidth="11rem"
                  />
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
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
          {modal}
        </div>
      </div>
      </DashboardShellContext.Provider>
      </div>
      </IconContext.Provider>
    </TooltipProvider>
  );
}
