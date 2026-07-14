export function cleanWebsiteDomain(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\//i, "");
  const withoutTrailing = trimmed.replace(/\/.*$/, "");
  return withoutTrailing.replace(/^www\./i, "");
}
