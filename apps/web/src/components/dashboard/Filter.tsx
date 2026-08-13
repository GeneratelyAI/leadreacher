"use client";

import type { CSSProperties, ReactNode } from "react";
import { ChevronDown, Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export type FilterGroup = {
  label: string;
  options: FilterOption[];
};

type FilterProps = {
  value: string;
  groups: FilterGroup[];
  onValueChange: (value: string) => void;
  allLabel?: string;
  allIcon?: ReactNode;
  showAll?: boolean;
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
  /** Minimum CSS width for the menu. The menu grows to fit its longest label. */
  menuWidth?: string;
  "aria-label"?: string;
};

export function normalizeFilterValues(value: string[], options: FilterOption[]): string[] {
  const availableValues = new Set(options.map((option) => option.value));
  return [...new Set(value)].filter((optionValue) => availableValues.has(optionValue));
}

export function Filter({
  value,
  groups,
  onValueChange,
  allLabel = "All activity",
  allIcon = <FilterIcon className="size-5" aria-hidden />,
  showAll = true,
  className,
  labelClassName,
  contentClassName,
  menuWidth = "12rem",
  "aria-label": ariaLabel = "Filter",
}: FilterProps) {
  const selected = groups.flatMap((group) => group.options).find((option) => option.value === value);
  const triggerLabel = selected?.label ?? allLabel;
  const triggerIcon = selected?.icon ?? allIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={cn("h-10 min-w-48 justify-between gap-3 rounded-lg px-3.5 text-sm font-medium", className)}
            aria-label={ariaLabel}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-onboarding-neutral-500 dark:text-onboarding-neutral-300">{triggerIcon}</span>
          <span className={cn("truncate", labelClassName)}>{triggerLabel}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("max-h-[min(34rem,var(--available-height))] !w-max min-w-[var(--filter-menu-min-width)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl p-1.5", contentClassName)}
        style={{ "--filter-menu-min-width": menuWidth } as CSSProperties}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {showAll ? (
            <DropdownMenuRadioItem
              value=""
              closeOnClick
              className="min-h-12 gap-3 rounded-lg px-3.5 py-3 pr-10 text-base data-checked:bg-onboarding-purple-50 dark:data-checked:bg-onboarding-purple-900/40 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-onboarding-purple-600 dark:[&_[data-slot=dropdown-menu-radio-item-indicator]]:text-onboarding-purple-200"
            >
              <span className="shrink-0 text-onboarding-neutral-500 dark:text-onboarding-neutral-300">{allIcon}</span>
              <span className="min-w-0 flex-1 truncate">{allLabel}</span>
            </DropdownMenuRadioItem>
          ) : null}
          {groups.map((group, groupIndex) => (
            <DropdownMenuGroup key={group.label}>
              {(showAll || groupIndex > 0) ? <DropdownMenuSeparator className={groupIndex === 0 ? "my-1.5" : "my-2"} /> : null}
              <DropdownMenuLabel className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.options.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  closeOnClick
                  className="min-h-12 gap-3 rounded-lg px-3.5 py-3 pr-10 text-base data-checked:bg-onboarding-purple-50 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-transparent data-checked:before:bg-onboarding-purple-600 dark:data-checked:bg-onboarding-purple-900/40 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-onboarding-purple-600 dark:[&_[data-slot=dropdown-menu-radio-item-indicator]]:text-onboarding-purple-200"
                >
                  {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate leading-5">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type MultiFilterProps = Omit<FilterProps, "value" | "onValueChange"> & {
  value: string[];
  onValueChange: (value: string[]) => void;
};

export function MultiFilter({
  value,
  groups,
  onValueChange,
  allLabel = "All",
  allIcon = <FilterIcon className="size-5" aria-hidden />,
  className,
  contentClassName,
  menuWidth = "12rem",
  "aria-label": ariaLabel = "Filter",
}: MultiFilterProps) {
  const options = groups.flatMap((group) => group.options);
  const normalizedValue = normalizeFilterValues(value, options);
  const allSelected = normalizedValue.length === 0 || (options.length > 0 && normalizedValue.length === options.length);
  const selected = allSelected ? [] : options.filter((option) => normalizedValue.includes(option.value));
  const triggerLabel = allSelected ? allLabel : selected.length === 1 ? selected[0]?.label ?? allLabel : `${selected.length} selected`;
  const triggerIcon = selected.length === 1 ? selected[0]?.icon ?? allIcon : allIcon;

  function toggle(optionValue: string) {
    if (allSelected) {
      onValueChange(options.filter((option) => option.value !== optionValue).map((option) => option.value));
      return;
    }
    const next = normalizedValue.includes(optionValue)
      ? normalizedValue.filter((current) => current !== optionValue)
      : [...normalizedValue, optionValue];
    onValueChange(next.length === 0 || next.length === options.length ? [] : next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={cn("h-10 min-w-48 justify-between gap-3 rounded-lg px-3.5 text-sm font-medium", className)}
            aria-label={ariaLabel}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-onboarding-neutral-500 dark:text-onboarding-neutral-300">{triggerIcon}</span>
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("max-h-[min(34rem,var(--available-height))] !w-max min-w-[var(--filter-menu-min-width)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl p-1.5", contentClassName)}
        style={{ "--filter-menu-min-width": menuWidth } as CSSProperties}
      >
        <DropdownMenuCheckboxItem
          checked={allSelected}
          closeOnClick={false}
          className="min-h-12 gap-3 rounded-lg px-3.5 py-3 pr-10 text-base data-checked:bg-onboarding-purple-50 dark:data-checked:bg-onboarding-purple-900/40 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:text-onboarding-purple-600 dark:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:text-onboarding-purple-200"
          onCheckedChange={() => onValueChange([])}
        >
          <span className="shrink-0 text-onboarding-neutral-500 dark:text-onboarding-neutral-300">{allIcon}</span>
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        </DropdownMenuCheckboxItem>
        {groups.map((group, groupIndex) => (
          <DropdownMenuGroup key={group.label}>
            <DropdownMenuSeparator className={groupIndex === 0 ? "my-1.5" : "my-2"} />
            <DropdownMenuLabel className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.options.map((option) => {
              const active = allSelected || normalizedValue.includes(option.value);
              return (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={active}
                  closeOnClick={false}
                  className="relative min-h-12 gap-3 rounded-lg px-3.5 py-3 pr-10 text-base data-checked:bg-onboarding-purple-50 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-transparent data-checked:before:bg-onboarding-purple-600 dark:data-checked:bg-onboarding-purple-900/40 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:text-onboarding-purple-600 dark:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:text-onboarding-purple-200"
                  onCheckedChange={() => toggle(option.value)}
                >
                  {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate leading-5">{option.label}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
