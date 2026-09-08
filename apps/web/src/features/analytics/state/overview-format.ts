import type { DashboardOverview } from "./overview-model";

export function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LR";
}

export function accountFirstName(overview: DashboardOverview | null, fallback: string): string {
  const linkedinAccount = overview?.channels.find(
    (channel) => channel.status === "active" && channel.platform.toLowerCase() === "linkedin",
  );
  const accountName = linkedinAccount?.accountName.trim() || fallback.trim();
  return accountName.split(/\s+/)[0] || "there";
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
