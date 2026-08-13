"use client";

import type { LucideIcon } from "lucide-react";
import { Command as CommandIcon, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type CommandPaletteItem = {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void;
};

export type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandPaletteGroup[];
  isLoading?: boolean;
  placeholder?: string;
};

function matchesQuery(item: CommandPaletteItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return [item.title, item.description, ...(item.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  isLoading = false,
  placeholder = "Search commands, prospects, and campaigns...",
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () => groups
      .map((group) => ({ ...group, items: group.items.filter((item) => matchesQuery(item, normalizedQuery)) }))
      .filter((group) => group.items.length > 0),
    [groups, normalizedQuery],
  );
  const items = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  function selectItem(item: CommandPaletteItem | undefined) {
    if (!item) return;
    item.onSelect();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden border-app-border bg-app-elevated p-0 sm:max-w-[42rem]" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b border-app-border px-4">
          <Search className="size-4 shrink-0 text-app-fg-subtle" aria-hidden />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(current + 1, Math.max(0, items.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                selectItem(items[selectedIndex]);
              }
            }}
            placeholder={placeholder}
            className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            aria-activedescendant={items[selectedIndex] ? `command-${items[selectedIndex].id}` : undefined}
            aria-controls="dashboard-command-results"
            aria-label="Search commands, prospects, and campaigns"
            role="combobox"
            aria-expanded={open}
          />
          <kbd className="rounded border border-app-border px-1.5 py-0.5 text-[10px] font-medium text-app-fg-subtle">ESC</kbd>
        </div>

        <div id="dashboard-command-results" role="listbox" className="max-h-[min(60dvh,30rem)] overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 px-2 py-3" aria-label="Searching workspace">
              <div className="h-4 w-24 animate-pulse rounded bg-app-muted-surface" />
              <div className="h-12 animate-pulse rounded-md bg-app-muted-surface" />
              <div className="h-12 animate-pulse rounded-md bg-app-muted-surface" />
            </div>
          ) : null}
          {!isLoading && visibleGroups.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-app-fg-muted">No matching commands, prospects, or campaigns.</p>
          ) : null}
          {!isLoading ? visibleGroups.map((group) => (
            <section key={group.id} className="py-1.5" aria-label={group.label}>
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.1em] text-app-fg-subtle uppercase">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const index = items.findIndex((candidate) => candidate.id === item.id);
                  const Icon = item.icon;
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`command-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => selectItem(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                        selected ? "bg-onboarding-purple-50 text-onboarding-purple-900 dark:bg-onboarding-purple-900/55 dark:text-onboarding-neutral-0" : "hover:bg-app-hover",
                      )}
                    >
                      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-md", selected ? "bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-800 dark:text-onboarding-purple-100" : "bg-app-muted-surface text-app-fg-muted")}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.description ? <span className="mt-0.5 block truncate text-xs text-app-fg-muted">{item.description}</span> : null}
                      </span>
                      {item.shortcut ? <kbd className="shrink-0 text-[10px] font-medium text-app-fg-subtle">{item.shortcut}</kbd> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          )) : null}
        </div>

        <div className="flex items-center justify-between border-t border-app-border bg-app-muted-surface px-4 py-2 text-[11px] text-app-fg-subtle">
          <span className="inline-flex items-center gap-1.5"><CommandIcon className="size-3" aria-hidden />Command menu</span>
          <span>↑↓ to navigate · Enter to select</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
