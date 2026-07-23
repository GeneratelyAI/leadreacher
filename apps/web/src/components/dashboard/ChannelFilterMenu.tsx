"use client";

import { ChevronDown, Mail } from "lucide-react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
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

function channelLabel(platform: string): string {
  const key = platform.toLowerCase();
  if (key === "linkedin") return "LinkedIn";
  if (key === "whatsapp") return "WhatsApp";
  if (key === "email" || key === "google" || key === "microsoft" || key === "imap") return "Email";
  return platform.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isChannelLogoName(value: string): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

function ChannelMark({ platform }: { platform: string }) {
  const key = platform.toLowerCase();
  if (isChannelLogoName(key)) {
    return (
      <span
        data-channel-mark
        className={cn(
          "pointer-events-none inline-flex size-5 shrink-0 items-center justify-center rounded-[0.3rem] text-white",
          key === "linkedin" ? "bg-[#0A66C2]" : "bg-[#25D366]",
        )}
        aria-hidden
      >
        {/* Hard fill so menu focus:**:text-* cannot recolor the mark. */}
        <ChannelLogo name={key} className="size-3" fill="#fff" />
      </span>
    );
  }
  return (
    <span
      data-channel-mark
      className="pointer-events-none inline-flex size-5 shrink-0 items-center justify-center text-onboarding-neutral-700 dark:text-onboarding-neutral-200"
      aria-hidden
    >
      <Mail className="size-3" />
    </span>
  );
}

export function formatChannelFilterLabel(selected: string[], options: string[]): string {
  if (selected.length === 0 || (options.length > 0 && selected.length === options.length)) {
    return "All channels";
  }
  if (selected.length === 1) return channelLabel(selected[0] ?? "");
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
              <span className="min-w-0 flex-1 truncate">{channelLabel(channel)}</span>
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

export { channelLabel };
