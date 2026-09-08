export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}
