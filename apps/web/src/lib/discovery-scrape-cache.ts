import { cleanWebsiteDomain } from "@/lib/website-url";

const CACHE_KEY = "lr_discovery_scrape";
const ORG_KEY = "lr_discovery_org_id";

export type DiscoveryScrapeCache = {
  urlKey: string;
  scope: string;
  status: "idle" | "running" | "completed" | "failed";
  market: string;
  offer: string;
  audience: string;
  value: string;
  strategyStatus: string;
  error: string | null;
};

type ScrapeStatusLike = Omit<DiscoveryScrapeCache, "urlKey" | "scope"> & {
  url: string | null;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function setDiscoveryOrgScope(orgId: string): void {
  if (isBrowser()) window.sessionStorage.setItem(ORG_KEY, orgId);
}

export function getDiscoveryOrgScope(): string | null {
  return isBrowser() ? window.sessionStorage.getItem(ORG_KEY)?.trim() || null : null;
}

export function clearDiscoveryOrgScope(): void {
  if (isBrowser()) window.sessionStorage.removeItem(ORG_KEY);
}

export function readDiscoveryScrapeCache(): DiscoveryScrapeCache | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DiscoveryScrapeCache>;
    if (
      !value.urlKey ||
      !value.scope ||
      !value.status ||
      typeof value.urlKey !== "string" ||
      typeof value.scope !== "string"
    ) {
      return null;
    }
    return {
      urlKey: value.urlKey,
      scope: value.scope,
      status: value.status,
      market: value.market ?? "",
      offer: value.offer ?? "",
      audience: value.audience ?? "",
      value: value.value ?? "",
      strategyStatus: value.strategyStatus ?? "",
      error: value.error ?? null,
    };
  } catch {
    return null;
  }
}

export function isDiscoveryScrapeCacheForOrg(
  cache: DiscoveryScrapeCache | null,
  orgId: string | null,
): cache is DiscoveryScrapeCache {
  return Boolean(orgId && cache?.scope === `org:${orgId}`);
}

export function discoveryScrapeSourceKey(
  orgId: string | null,
  url: string | null,
): string | null {
  if (!orgId || !url) {
    return null;
  }

  const urlKey = cleanWebsiteDomain(url).toLowerCase();
  return urlKey ? `org:${orgId}:${urlKey}` : null;
}

export function writeDiscoveryScrapeCache(
  status: ScrapeStatusLike,
  scope: string,
): void {
  if (!isBrowser() || !status.url) return;
  const urlKey = cleanWebsiteDomain(status.url).toLowerCase();
  if (!urlKey) return;
  const cache: DiscoveryScrapeCache = {
    urlKey,
    scope,
    status: status.status,
    market: status.market,
    offer: status.offer,
    audience: status.audience,
    value: status.value,
    strategyStatus: status.strategyStatus,
    error: status.error,
  };
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function promoteAnonymousDiscoveryCache(
  orgId: string,
  anonId: string | null,
  status?: ScrapeStatusLike | null,
): void {
  setDiscoveryOrgScope(orgId);
  const orgScope = `org:${orgId}`;
  if (status?.url) {
    writeDiscoveryScrapeCache(status, orgScope);
    return;
  }

  const cache = readDiscoveryScrapeCache();
  if (cache?.scope === `anon:${anonId ?? ""}`) {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cache, scope: orgScope }));
  }
}

export function readActiveScopedWebsiteUrl(): string | null {
  const orgId = getDiscoveryOrgScope();
  const cache = readDiscoveryScrapeCache();
  if (
    !orgId ||
    !cache ||
    cache.scope !== `org:${orgId}` ||
    cache.status !== "running"
  ) {
    return null;
  }
  return cache.urlKey;
}

export function clearDiscoveryScrapeCache(): void {
  if (isBrowser()) window.localStorage.removeItem(CACHE_KEY);
}
