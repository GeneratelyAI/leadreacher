import { Mail } from "@/components/ui/icons";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import { cn } from "@/lib/utils";

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function channelLogoName(platform: string, accountName?: string | null): ChannelLogoName | null {
  const channel = normalized(platform);
  const account = normalized(accountName ?? "");

  if (channel === "linkedin") return "linkedin";
  if (channel === "whatsapp") return "whatsapp-mark";
  if (channel === "instagram") return "instagram";
  if (["facebook", "messenger", "facebook_messenger"].includes(channel)) return "facebook";
  if (["gmail", "google", "google_mail"].includes(channel) || account.includes("gmail") || account.includes("google")) return "gmail";
  if (["outlook", "microsoft", "microsoft_365"].includes(channel) || account.includes("outlook") || account.includes("microsoft")) return "outlook";
  return null;
}

export function channelDisplayName(platform: string, accountName?: string | null): string {
  const logo = channelLogoName(platform, accountName);
  if (logo === "linkedin") return "LinkedIn";
  if (logo === "whatsapp-mark") return "WhatsApp";
  if (logo === "instagram") return "Instagram";
  if (logo === "facebook") return "Facebook";
  if (logo === "gmail") return "Gmail";
  if (logo === "outlook") return "Outlook";
  if (["email", "imap"].includes(normalized(platform))) return "Email";
  return platform.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export type ChannelMetricRow = {
  channel: string;
  messagesSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
};

export function groupEmailChannelMetrics<Row extends ChannelMetricRow>(rows: Row[]): {
  rows: ChannelMetricRow[];
  emailProviders: Row[];
} {
  const emailProviders = rows.filter((row) => ["gmail", "outlook"].includes(channelLogoName(row.channel) ?? ""));
  const genericEmail = rows.filter((row) => ["email", "imap"].includes(normalized(row.channel)));
  const nonEmail = rows.filter((row) => !emailProviders.includes(row) && !genericEmail.includes(row));
  const emailRows = [...emailProviders, ...genericEmail];
  const messagesSent = emailRows.reduce((sum, row) => sum + row.messagesSent, 0);
  const replies = emailRows.reduce((sum, row) => sum + row.replies, 0);
  const email = emailRows.length ? {
    channel: "email",
    messagesSent,
    replies,
    replyRate: messagesSent ? Math.round((replies / messagesSent) * 1000) / 10 : 0,
    meetingsBooked: emailRows.reduce((sum, row) => sum + row.meetingsBooked, 0),
  } : null;

  return { rows: email ? [...nonEmail, email] : nonEmail, emailProviders };
}

export function DashboardChannelLogo({
  platform,
  accountName,
  className,
}: {
  platform: string;
  accountName?: string | null;
  className?: string;
}) {
  const logo = channelLogoName(platform, accountName);
  if (logo) return <ChannelLogo name={logo} className={cn("size-5 shrink-0", className)} />;
  return <Mail className={cn("size-5 shrink-0 text-muted-foreground", className)} aria-hidden />;
}
