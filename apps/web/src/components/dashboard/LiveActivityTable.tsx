"use client";

import Link from "next/link";
import { Megaphone, MessageSquare, Users, Video } from "lucide-react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type LiveActivityTableItem = {
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

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function isChannelLogoName(value: string): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

function ChannelMark({
  name,
  size = "default",
  className,
}: {
  name: "linkedin" | "whatsapp";
  size?: "default" | "badge";
  className?: string;
}) {
  const isLinkedIn = name === "linkedin";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.3rem] text-white",
        size === "badge" ? "size-4" : "size-8",
        isLinkedIn ? "bg-[#0A66C2]" : "bg-[#25D366]",
        className,
      )}
      aria-hidden
    >
      <ChannelLogo name={name} className={size === "badge" ? "size-2.5" : "size-[62%]"} />
    </span>
  );
}

function ActivityMark({ item }: { item: LiveActivityTableItem }) {
  const channel = item.channel ?? "";

  if (item.avatarUrl) {
    return (
      <span className="relative size-9 shrink-0" aria-hidden>
        <img src={item.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        {isChannelLogoName(channel) ? (
          <ChannelMark
            name={channel}
            size="badge"
            className="absolute -right-0.5 -bottom-0.5 border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900"
          />
        ) : null}
      </span>
    );
  }

  if (isChannelLogoName(channel)) return <ChannelMark name={channel} />;

  const Icon = item.kind === "message" ? MessageSquare : item.kind === "prospect" ? Users : item.kind === "video" ? Video : Megaphone;
  return <Icon className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
}

const columns: ColumnDef<LiveActivityTableItem>[] = [
  {
    id: "activity",
    header: "Activity",
    cell: ({ row }) => {
      const item = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <ActivityMark item={item} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "occurredAt",
    header: "Time",
    cell: ({ row }) => (
      <time dateTime={row.original.occurredAt} className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
        {relativeTime(row.original.occurredAt)}
      </time>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => {
      const item = row.original;
      const href = item.href ?? "/dashboard/activity";

      return (
        <Button asChild variant="outline" size="sm">
          <Link href={href}>{item.action === "reply" ? "Reply" : "View"}</Link>
        </Button>
      );
    },
  },
];

export function LiveActivityTable({ data }: { data: LiveActivityTableItem[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader className="sr-only">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="border-onboarding-neutral-150 hover:bg-onboarding-neutral-50 dark:border-onboarding-neutral-750 dark:hover:bg-onboarding-neutral-850">
            {row.getVisibleCells().map((cell, index) => (
              <TableCell
                key={cell.id}
                className={cn(
                  "whitespace-normal py-2.5",
                  index === 0 && "w-full pl-5",
                  index === 1 && "shrink-0 px-2 text-right",
                  index === 2 && "shrink-0 pr-5 pl-2 text-right",
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
