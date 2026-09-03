import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  /**
   * Exactly one column should set `isLabel`. Its rendered value becomes the
   * mobile card's title line instead of a "header: value" row, mirroring how
   * the desktop table treats it as the row's identity column.
   */
  isLabel?: boolean;
  render: (row: Row, context: { isFooter: boolean }) => ReactNode;
  className?: string;
};

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  data: Row[];
  getRowKey: (row: Row) => string;
  /** Rendered as a totals row via the same column `render` functions with `isFooter: true`. */
  footer?: Row;
};

/**
 * Dense label + numeric-metrics table (channel/campaign performance, etc).
 * Renders a real `<table>` at `lg` and up; below that, each row becomes a
 * compact card with the label column as its title and every other column as
 * a stacked "header: value" line. Callers handle their own empty state
 * before rendering this, since copy differs per table.
 */
export function DataTable<Row>({ columns, data, getRowKey, footer }: DataTableProps<Row>) {
  const labelColumn = columns.find((column) => column.isLabel);
  const metricColumns = columns.filter((column) => !column.isLabel);

  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.align === "right" && "text-right", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.align === "right" && "text-right", column.className)}
                  >
                    {column.render(row, { isFooter: false })}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {footer ? (
            <TableFooter>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "font-semibold",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.render(footer, { isFooter: true })}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {data.map((row) => (
          <li key={getRowKey(row)} className="space-y-2 px-4 py-3.5">
            {labelColumn ? (
              <div className="font-medium">{labelColumn.render(row, { isFooter: false })}</div>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {metricColumns.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground">{column.header}</dt>
                  <dd>{column.render(row, { isFooter: false })}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {footer ? (
          <li className="space-y-2 bg-muted/40 px-4 py-3.5 font-semibold">
            {labelColumn ? <div>{labelColumn.render(footer, { isFooter: true })}</div> : null}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {metricColumns.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-2 text-sm">
                  <dt className="font-normal text-muted-foreground">{column.header}</dt>
                  <dd>{column.render(footer, { isFooter: true })}</dd>
                </div>
              ))}
            </dl>
          </li>
        ) : null}
      </ul>
    </>
  );
}
