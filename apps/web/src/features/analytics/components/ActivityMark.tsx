import { Trophy, Sparkles, Users, Megaphone } from "@/components/ui/icons";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlatformLogo } from "@/features/channels/public/Channel";
import { initials } from "../state/activity-format";
import type { ActivityItem } from "../state/activity-model";

export function ActivityMark({ item }: { item: ActivityItem }) {
  if (item.avatarUrl) {
    return (
      <span className="relative size-9 shrink-0" aria-hidden>
        <Avatar size="default">
          <AvatarImage src={item.avatarUrl} alt="" />
          <AvatarFallback className="bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
            {initials(item.title)}
          </AvatarFallback>
        </Avatar>
        {item.channel ? (
          <PlatformLogo platform={item.channel} className="absolute -right-0.5 -bottom-0.5 size-4 rounded-sm border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900" />
        ) : null}
      </span>
    );
  }

  if (item.channel) return <PlatformLogo platform={item.channel} className="size-8" />;

  if (item.kind === "campaign") {
    return <Trophy className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  if (item.kind === "video") {
    return <Sparkles className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  if (item.kind === "prospect") {
    return <Users className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  return <Megaphone className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
}
