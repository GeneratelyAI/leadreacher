"use client";

import { ChevronDown } from "lucide-react";
import { channelDisplayName, DashboardChannelLogo } from "@/components/dashboard/ChannelIdentity";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const menuCheckboxClassName = cn(
  "pointer-events-none border-onboarding-neutral-250 bg-onboarding-neutral-0 shadow-none",
  "data-checked:border-onboarding-neutral-300 data-checked:bg-onboarding-neutral-0 data-checked:text-onboarding-ink",
  "dark:border-onboarding-neutral-600 dark:bg-onboarding-neutral-0 dark:data-checked:border-onboarding-neutral-500 dark:data-checked:bg-onboarding-neutral-0 dark:data-checked:text-onboarding-ink",
);

function ChannelMark({ platform }: { platform: string }) {
  return <DashboardChannelLogo platform={platform} className="pointer-events-none size-5" />;
}

export function formatChannelFilterLabel(selected: string[], options: string[]): string {
  if (selected.length === 0 || (options.length > 0 && selected.length === options.length)) {
    return "All channels";
  }
  if (selected.length === 1) return channelDisplayName(selected[0] ?? "");
  return `${selected.length} channels`;
}

function normalizeSelection(next: string[], options: string[]): string[] {
  const unique = [...new Set(next.filter((value) => options.includes(value)))];
  if (unique.length === 0 || (options.length > 0 && unique.length === options.length)) return [];
  return unique;
}

type ChannelFilterMenuProps = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  "aria-label"?: string;
};

export function ChannelFilterMenu({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Filter by channel",
}: ChannelFilterMenuProps) {
  const allSelected = value.length === 0;
  const triggerLabel = formatChannelFilterLabel(value, options);

  function toggleChannel(channel: string, checked: boolean) {
    if (allSelected) {
      if (!checked) {
        onChange(normalizeSelection(options.filter((option) => option !== channel), options));
      }
      return;
    }

    if (checked) {
      onChange(normalizeSelection([...value, channel], options));
      return;
    }

    onChange(normalizeSelection(value.filter((option) => option !== channel), options));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-9 w-full min-w-40 justify-between gap-2 px-3 font-normal", className)}
            aria-label={ariaLabel}
          />
        }
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuItem
          className="gap-2"
          closeOnClick={false}
          onClick={() => {
            onChange([]);
          }}
        >
          <span className="min-w-0 flex-1 truncate">All channels</span>
          <Checkbox
            checked={allSelected}
            tabIndex={-1}
            className={menuCheckboxClassName}
            aria-hidden
          />
        </DropdownMenuItem>
        {options.map((channel) => {
          const checked = allSelected || value.includes(channel);
          return (
            <DropdownMenuItem
              key={channel}
              className="gap-2"
              closeOnClick={false}
              onClick={() => {
                toggleChannel(channel, !checked);
              }}
            >
              <ChannelMark platform={channel} />
              <span className="min-w-0 flex-1 truncate">{channelDisplayName(channel)}</span>
              <Checkbox
                checked={checked}
                tabIndex={-1}
                className={menuCheckboxClassName}
                aria-hidden
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { channelDisplayName as channelLabel };
