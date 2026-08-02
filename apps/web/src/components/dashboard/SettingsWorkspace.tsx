"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  KeyRound,
  Loader2,
  Mail,
  MoreVertical,
  Plug,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

type WorkspaceSettings = {
  organization: {
    id: string;
    name: string;
    plan: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    hasBillingPortal: boolean;
  } | null;
  members: TeamMember[];
};

type SocialAccount = {
  id: string;
  platform: string;
  accountName: string;
  avatarUrl: string | null;
  status: string;
};

type Preferences = {
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  emailNotifications: boolean;
  weeklySummary: boolean;
  productTips: boolean;
  soundNotifications: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  timezone: "America/Sao_Paulo",
  dateFormat: "medium",
  timeFormat: "12h",
  emailNotifications: true,
  weeklySummary: true,
  productTips: true,
  soundNotifications: false,
};

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "(GMT-03:00) America/Sao Paulo" },
  { value: "America/New_York", label: "(GMT-05:00) America/New York" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) America/Los Angeles" },
  { value: "Europe/London", label: "(GMT+00:00) Europe/London" },
  { value: "Europe/Berlin", label: "(GMT+01:00) Europe/Berlin" },
  { value: "Asia/Singapore", label: "(GMT+08:00) Asia/Singapore" },
  { value: "UTC", label: "(GMT+00:00) UTC" },
];

const INTEGRATION_ROWS: Array<{
  key: string;
  label: string;
  platforms: string[];
  logo?: "linkedin" | "whatsapp";
  soon?: boolean;
}> = [
  { key: "linkedin", label: "LinkedIn", platforms: ["linkedin"], logo: "linkedin" },
  { key: "whatsapp", label: "WhatsApp", platforms: ["whatsapp"], logo: "whatsapp" },
  { key: "email", label: "Email", platforms: ["email", "google", "microsoft", "imap"] },
  { key: "zapier", label: "Zapier", platforms: [], soon: true },
];

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function prefsStorageKey(orgId: string): string {
  return `leadreacher-settings-prefs:${orgId}`;
}

function readPreferences(orgId: string): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(prefsStorageKey(orgId));
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) as Partial<Preferences> };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(orgId: string, preferences: Preferences) {
  window.localStorage.setItem(prefsStorageKey(orgId), JSON.stringify(preferences));
}

function formatBillingDate(value: string | null): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function dateFormatPreview(format: string, timeFormat: "12h" | "24h"): string {
  const now = new Date("2024-05-12T15:30:00.000Z");
  if (format === "iso") return "2024-05-12";
  if (format === "short") return "05/12/2024";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(now);
  if (format === "long") {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(now);
  }
  void timeFormat;
  return date;
}

function roleBadgeClass(role: string): string {
  if (role === "owner") {
    return "border-transparent bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100";
  }
  if (role === "admin") {
    return "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-100";
  }
  return "border-transparent bg-onboarding-neutral-100 text-onboarding-neutral-700 dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-200";
}

function subscriptionBadgeClass(status: string | null): string {
  if (status === "active") {
    return "border-transparent bg-onboarding-success-50 text-onboarding-success-700 dark:bg-onboarding-success-500/20 dark:text-onboarding-success-300 dark:ring-1 dark:ring-onboarding-success-400/25";
  }
  return "border-transparent bg-onboarding-neutral-100 text-onboarding-neutral-700 dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-200";
}

function SettingsSectionCard({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200 [&_svg]:size-5">
            {icon}
          </span>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ComingSoonButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex w-full sm:w-auto" />
        }
      >
        <Button variant="secondary" className="w-full sm:w-auto" disabled tabIndex={-1}>
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Coming soon</TooltipContent>
    </Tooltip>
  );
}

export function SettingsWorkspace() {
  const [name, setName] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["dashboard", "settings"],
    queryFn: () => apiFetch<WorkspaceSettings>("/dashboard/settings"),
    staleTime: 60_000,
  });
  const accountsQuery = useQuery({
    queryKey: ["dashboard", "settings", "accounts"],
    queryFn: () => apiFetch<{ accounts: SocialAccount[] }>("/social-accounts").catch(() => ({ accounts: [] as SocialAccount[] })),
    staleTime: 60_000,
  });
  const settings = settingsQuery.data ?? null;
  const accounts = accountsQuery.data?.accounts ?? [];
  const isLoading = settingsQuery.isLoading && !settingsQuery.data;
  const error = actionError ?? (settingsQuery.error instanceof Error ? settingsQuery.error.message : null);

  useEffect(() => {
    const organization = settingsQuery.data?.organization;
    if (!organization?.id) return;
    setName(organization.name ?? "");
    setPreferences(readPreferences(organization.id));
  }, [settingsQuery.data?.organization?.id]);

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      if (settings?.organization?.id) writePreferences(settings.organization.id, next);
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await apiFetch<WorkspaceSettings>("/dashboard/settings", {
        method: "PATCH",
        body: JSON.stringify({ organizationName: name }),
      });
      queryClient.setQueryData<WorkspaceSettings>(["dashboard", "settings"], result);
      setName(result.organization?.name ?? name);
      setActionError(null);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openPortal() {
    try {
      const session = await apiFetch<{ url: string }>("/billing/portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.location.assign(session.url);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to open billing portal.");
    }
  }

  const integrationStatuses = useMemo(() => {
    return INTEGRATION_ROWS.map((row) => {
      if (row.soon) {
        return { ...row, connected: false, detail: "Coming soon" };
      }
      const match = accounts.find(
        (account) => row.platforms.includes(account.platform.toLowerCase()) && account.status === "active",
      );
      return {
        ...row,
        connected: Boolean(match),
        detail: match ? match.accountName : "Not connected",
      };
    });
  }, [accounts]);

  const organization = settings?.organization ?? null;
  const members = settings?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Update your workspace details and manage your account preferences.
        </p>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading settings
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <SettingsSectionCard icon={<Building2 className="size-5" strokeWidth={1.75} aria-hidden />} title="Organization">
              <form onSubmit={save} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input
                    id="workspace-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
                <Button type="submit" variant="brand" disabled={isSaving || !name.trim()}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Save changes
                </Button>
              </form>
            </SettingsSectionCard>

            <SettingsSectionCard icon={<CreditCard className="size-5" strokeWidth={1.75} aria-hidden />} title="Plan and billing">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Plan</dt>
                  <dd className="mt-1.5">
                    <Badge className="border-transparent bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-500/20 dark:text-onboarding-purple-200 dark:ring-1 dark:ring-onboarding-purple-300/25">
                      {titleCase(organization?.plan ?? "starter")} Plan
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Subscription</dt>
                  <dd className="mt-1.5">
                    <Badge className={subscriptionBadgeClass(organization?.subscriptionStatus ?? null)}>
                      {titleCase(organization?.subscriptionStatus ?? "not active")}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Next billing date</dt>
                  <dd className="mt-1.5 text-sm font-medium">{formatBillingDate(organization?.currentPeriodEnd ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Amount</dt>
                  <dd className="mt-1.5 text-sm font-medium text-muted-foreground">Managed via billing portal</dd>
                </div>
              </dl>
              {organization?.hasBillingPortal ? (
                <Button variant="secondary" className="w-full" onClick={() => void openPortal()}>
                  <CreditCard /> Manage billing
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Billing portal unlocks after an active subscription is linked to this workspace.
                </p>
              )}
            </SettingsSectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <SettingsSectionCard icon={<SlidersHorizontal className="size-5" strokeWidth={1.75} aria-hidden />} title="Preferences">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(value) => updatePreference("timezone", value ?? DEFAULT_PREFERENCES.timezone)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue>
                        {(value) => TIMEZONES.find((zone) => zone.value === value)?.label ?? String(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((zone) => (
                        <SelectItem key={zone.value} value={zone.value}>
                          {zone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Date format</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(value) => updatePreference("dateFormat", value ?? "medium")}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue>
                        {(value) => dateFormatPreview(String(value ?? "medium"), preferences.timeFormat)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medium">{dateFormatPreview("medium", preferences.timeFormat)}</SelectItem>
                      <SelectItem value="long">{dateFormatPreview("long", preferences.timeFormat)}</SelectItem>
                      <SelectItem value="short">{dateFormatPreview("short", preferences.timeFormat)}</SelectItem>
                      <SelectItem value="iso">{dateFormatPreview("iso", preferences.timeFormat)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Time format</Label>
                  <Select
                    value={preferences.timeFormat}
                    onValueChange={(value) => updatePreference("timeFormat", value === "24h" ? "24h" : "12h")}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue>
                        {(value) => (value === "24h" ? "24-hour" : "12-hour (AM/PM)")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="divide-y divide-border rounded-lg border border-border">
                  {[
                    {
                      key: "emailNotifications" as const,
                      label: "Email notifications",
                      detail: "Receive alerts about replies and campaign activity",
                    },
                    {
                      key: "weeklySummary" as const,
                      label: "Weekly performance summary",
                      detail: "A weekly digest of outreach results",
                    },
                    {
                      key: "productTips" as const,
                      label: "Tips and product updates",
                      detail: "Occasional product tips and release notes",
                    },
                    {
                      key: "soundNotifications" as const,
                      label: "Sound notifications",
                      detail: "Play a sound when new replies arrive",
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <Switch
                        checked={preferences[item.key]}
                        onCheckedChange={(checked) => updatePreference(item.key, checked)}
                        aria-label={item.label}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Preferences are saved in this browser for now. Server-synced prefs are coming later.
                </p>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard icon={<Users className="size-5" strokeWidth={1.75} aria-hidden />} title="Team">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {members.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-muted-foreground">No team members found for this workspace.</li>
                ) : (
                  members.map((member) => {
                    const displayName = member.name?.trim() || member.email;
                    return (
                      <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
                            {initials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <Badge className={roleBadgeClass(member.role)}>{titleCase(member.role)}</Badge>
                        {member.role !== "owner" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" aria-label={`Actions for ${displayName}`} />}
                            >
                              <MoreVertical />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem disabled>Change role (coming soon)</DropdownMenuItem>
                              <DropdownMenuItem disabled>Remove member (coming soon)</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
              <Button variant="secondary" className="w-full" onClick={() => setTeamDialogOpen(true)}>
                <Users /> Manage team
              </Button>
            </SettingsSectionCard>

            <SettingsSectionCard icon={<Plug className="size-5" strokeWidth={1.75} aria-hidden />} title="Connected integrations">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {integrationStatuses.map((row) => (
                  <li key={row.key}>
                    {row.soon ? (
                      <div className="flex items-center gap-3 px-4 py-3 opacity-70">
                        <span className="inline-flex size-8 items-center justify-center text-onboarding-neutral-600 dark:text-onboarding-neutral-300">
                          <Plug className="size-5" strokeWidth={1.75} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">{row.detail}</p>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href="/dashboard/channels"
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        {row.logo ? (
                          row.logo === "linkedin" ? (
                            <span className="inline-flex size-8 items-center justify-center" aria-hidden>
                              <ChannelLogo name="linkedin" className="size-8" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex size-8 items-center justify-center rounded-md bg-[#25D366] text-white"
                              aria-hidden
                            >
                              <ChannelLogo name={row.logo} className="size-4" />
                            </span>
                          )
                        ) : (
                          <span className="inline-flex size-8 items-center justify-center text-onboarding-neutral-700 dark:text-onboarding-neutral-200">
                            <Mail className="size-5" strokeWidth={1.75} aria-hidden />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {row.connected ? (
                              <>
                                <span className="size-1.5 rounded-full bg-onboarding-success-500" aria-hidden />
                                Connected
                              </>
                            ) : (
                              row.detail
                            )}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/dashboard/channels">
                  <Plug /> Manage integrations
                </Link>
              </Button>
            </SettingsSectionCard>
          </div>

          <SettingsSectionCard icon={<Shield className="size-5" strokeWidth={1.75} aria-hidden />} title="Workspace security">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Two-factor authentication",
                  detail: "Add an extra layer of security",
                  action: "Enable 2FA",
                  icon: <Shield className="size-5" strokeWidth={1.75} aria-hidden />,
                },
                {
                  title: "Active sessions",
                  detail: "Manage your active sessions",
                  action: "View sessions",
                  icon: <Users className="size-5" strokeWidth={1.75} aria-hidden />,
                },
                {
                  title: "Allowed IP addresses",
                  detail: "Restrict access to specific IPs",
                  action: "Manage IPs",
                  icon: <Shield className="size-5" strokeWidth={1.75} aria-hidden />,
                },
                {
                  title: "API access",
                  detail: "Manage API keys and access",
                  action: "Manage API keys",
                  icon: <KeyRound className="size-5" strokeWidth={1.75} aria-hidden />,
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex shrink-0 text-onboarding-neutral-700 dark:text-onboarding-neutral-200">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ComingSoonButton label={item.action} />
                  </div>
                </div>
              ))}
            </div>
          </SettingsSectionCard>
        </>
      )}

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage team</DialogTitle>
            <DialogDescription>
              Invites, role changes, and removals are not available yet. This workspace currently lists members
              in read-only mode.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTeamDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
