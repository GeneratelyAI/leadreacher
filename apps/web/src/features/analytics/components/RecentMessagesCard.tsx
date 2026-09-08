import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "@/components/ui/icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { initials, relativeTime } from "../state/overview-format";
import type { DashboardOverview } from "../state/overview-model";

export function RecentMessagesCard({ overview }: { overview: DashboardOverview }) {
  const messages = overview.actions?.needsReply ?? [];
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4">
        <CardTitle>Messages {overview.actions?.needsReplyCount ? <Badge className="ml-1.5">{overview.actions.needsReplyCount}</Badge> : null}</CardTitle>
        <Link href="/dashboard/messages" className="inline-flex items-center gap-1 text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View conversations <ArrowRight className="size-3" /></Link>
      </CardHeader>
      {messages.length ? (
        <ul className="grid flex-1 auto-rows-fr px-4">
          {messages.slice(0, 3).map((message, index) => (
            <li key={message.campaignLeadId} className={cn("flex items-center gap-3 py-3.5", index > 0 && "border-t border-app-border")}>
              <Avatar className="size-10"><AvatarImage src={message.avatarUrl ?? undefined} alt="" /><AvatarFallback>{initials(message.prospectName)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{message.prospectName}</p><p className="truncate text-xs text-muted-foreground">{message.preview}</p></div>
              <time className="text-xs text-muted-foreground" dateTime={message.occurredAt}>{relativeTime(message.occurredAt)}</time>
              <Button asChild variant="ghost" size="icon" aria-label={`Reply to ${message.prospectName}`}><Link href={`/dashboard/messages/${message.campaignLeadId}`}><ArrowRight /></Link></Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto size-6 text-onboarding-success-500" /><p className="mt-3 text-sm font-medium">Inbox is clear</p><p className="mt-1 text-xs text-muted-foreground">New inbound replies will appear here.</p></div>
      )}
    </Card>
  );
}
