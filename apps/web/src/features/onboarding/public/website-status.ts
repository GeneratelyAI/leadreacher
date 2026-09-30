"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  getDiscoveryOrgScope,
  readActiveScopedWebsiteUrl,
  writeDiscoveryScrapeCache,
} from "@/features/onboarding/public/discovery-cache";
import { cleanWebsiteDomain } from "@/lib/website-url";
import {
  fixtureWebsiteUrl,
  usesOnboardingFixtures,
} from "@/features/onboarding/public/preview-api";

export type WebsiteScrapeStatus = {
  status: "idle" | "running" | "completed" | "failed";
  url: string | null;
  market: string;
  offer: string;
  audience: string;
  value: string;
  strategyStatus: string;
  prospectProfile?: {
    decisionMakers: string[];
    companyTypes: string[];
    industries: string[];
    locations: string[];
  };
  error: string | null;
};

type WebsiteScrapeStore = {
  status: WebsiteScrapeStatus;
  loading: boolean;
  ready: boolean;
  message: string | null;
  websiteUrl: string | null;
  hasStoredUrl: boolean;
};

type ScrapeContext = "anonymous" | "authenticated";

type UseWebsiteScrapeStatusOptions = {
  autoStart?: boolean;
  context?: ScrapeContext;
};

type EnsureScrapeOptions = {
  force?: boolean;
  restartCompleted?: boolean;
  websiteUrl?: string;
};

type PublicApiError = {
  message?: string;
  error?: string;
};

const EMPTY_STATUS: WebsiteScrapeStatus = {
  status: "idle",
  url: null,
  market: "",
  offer: "",
  audience: "",
  value: "",
  strategyStatus: "",
  prospectProfile: {
    decisionMakers: [],
    companyTypes: [],
    industries: [],
    locations: [],
  },
  error: null,
};

const NO_WEBSITE_MESSAGE =
  "Enter your website URL on the homepage to see your personalized insights";

export function shouldStartFreshScrape(
  cachedStatus: WebsiteScrapeStatus,
  websiteUrl: string,
  startAttemptedForUrl: string | null,
): boolean {
  const isStaleForCurrentUrl =
    cachedStatus.url !== null &&
    cleanWebsiteDomain(cachedStatus.url).toLowerCase() !==
      cleanWebsiteDomain(websiteUrl).toLowerCase();

  return (
    (cachedStatus.status === "idle" || isStaleForCurrentUrl) &&
    startAttemptedForUrl !== websiteUrl
  );
}

export function isWebsiteScrapeTerminal(
  status: WebsiteScrapeStatus,
): boolean {
  return status.status === "completed" || status.status === "failed";
}

function readStoredWebsiteUrl(context: ScrapeContext): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (usesOnboardingFixtures()) return fixtureWebsiteUrl();

  if (context === "authenticated") {
    const scopedUrl = readActiveScopedWebsiteUrl();
    if (scopedUrl) return scopedUrl;
  }

  return window.localStorage.getItem("lr_website_url")?.trim() || null;
}

function readOrCreateAnonymousScrapeId(): string | null {
  if (typeof window === "undefined" || !readStoredWebsiteUrl("anonymous")) {
    return null;
  }

  const storedId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
  if (storedId) {
    return storedId;
  }

  const anonId = window.crypto.randomUUID();
  window.localStorage.setItem("lr_anon_scrape_id", anonId);
  return anonId;
}

function apiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  return baseUrl.replace(/\/$/, "");
}

async function anonymousFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error";
    throw new Error(`Unable to load website insights. (${reason})`);
  }

  const payload = (await response.json().catch(() => null)) as PublicApiError | T | null;
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}

export function createScrapeController(context: ScrapeContext) {
  let store: WebsiteScrapeStore = {
    status: EMPTY_STATUS,
    loading: false,
    ready: false,
    message: null,
    websiteUrl: null,
    hasStoredUrl: false,
  };
  const listeners = new Set<(nextStore: WebsiteScrapeStore) => void>();
  let activeWebsiteUrl: string | null = null;
  let activeScope: string | null = null;
  let startAttemptedForUrl: string | null = null;
  let pollTimer: number | undefined;
  let statusRequest: Promise<WebsiteScrapeStatus> | null = null;
  let statusRequestUrl: string | null = null;
  let statusRequestScope: string | null = null;
  let requestVersion = 0;

  function notify(nextStore: WebsiteScrapeStore): void {
    store = nextStore;
    listeners.forEach((listener) => listener(store));
  }

  function updateStore(patch: Partial<WebsiteScrapeStore>): WebsiteScrapeStore {
    const nextStore = { ...store, ...patch };
    notify(nextStore);
    return nextStore;
  }

  function currentScope(): string | null {
    if (context === "authenticated") {
      const orgId = getDiscoveryOrgScope();
      return orgId ? `org:${orgId}` : null;
    }
    const anonId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
    return anonId ? `anon:${anonId}` : null;
  }

  function selectWebsiteUrl(websiteUrl: string): void {
    if (websiteUrl === readStoredWebsiteUrl(context)) return;
    const scope = currentScope();
    if (context === "authenticated" && scope) {
      writeDiscoveryScrapeCache({ ...EMPTY_STATUS, url: websiteUrl }, scope);
      window.localStorage.removeItem("lr_website_url");
    } else {
      window.localStorage.setItem("lr_website_url", websiteUrl);
    }
  }

  function syncStoredWebsiteUrl(): string | null {
    const websiteUrl = readStoredWebsiteUrl(context);
    const scope = currentScope();

    if (!websiteUrl) {
      activeWebsiteUrl = null;
      activeScope = null;
      startAttemptedForUrl = null;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      updateStore({
        status: EMPTY_STATUS,
        loading: false,
        ready: false,
        message: NO_WEBSITE_MESSAGE,
        websiteUrl: null,
        hasStoredUrl: false,
      });
      return null;
    }

    if (activeWebsiteUrl !== websiteUrl || activeScope !== scope) {
      activeWebsiteUrl = websiteUrl;
      activeScope = scope;
      startAttemptedForUrl = null;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      updateStore({
        status: { ...EMPTY_STATUS, url: websiteUrl },
        loading: false,
        ready: false,
        message: null,
        websiteUrl,
        hasStoredUrl: true,
      });
    } else if (store.websiteUrl !== websiteUrl || !store.hasStoredUrl) {
      updateStore({
        websiteUrl,
        hasStoredUrl: true,
        message: null,
      });
    }

    return websiteUrl;
  }

  function persistScrapeStatus(
    status: WebsiteScrapeStatus,
    anonId: string | null,
  ): void {
    const orgId = getDiscoveryOrgScope();
    const scope =
      context === "anonymous"
        ? anonId
          ? `anon:${anonId}`
          : null
        : orgId
          ? `org:${orgId}`
          : null;
    if (scope) writeDiscoveryScrapeCache(status, scope);
  }

  function schedulePoll(): void {
    if (pollTimer !== undefined) {
      window.clearTimeout(pollTimer);
    }

    pollTimer = window.setTimeout(() => {
      void ensureWebsiteScrapeStarted();
    }, 2000);
  }

  async function getStatus(anonId: string | null): Promise<WebsiteScrapeStatus> {
    if (usesOnboardingFixtures()) {
      return apiFetch<WebsiteScrapeStatus>("/discovery/scrape-status");
    }
    if (context === "anonymous") {
      if (!anonId) {
        return EMPTY_STATUS;
      }
      return anonymousFetch<WebsiteScrapeStatus>(
        `/discovery/scrape/anonymous-status?anonId=${encodeURIComponent(anonId)}`,
      );
    }

    return apiFetch<WebsiteScrapeStatus>("/discovery/scrape-status");
  }

  async function startScrape(
    websiteUrl: string,
    anonId: string | null,
  ): Promise<WebsiteScrapeStatus> {
    if (usesOnboardingFixtures()) {
      return apiFetch<WebsiteScrapeStatus>("/discovery/scrape", {
        method: "POST",
        body: JSON.stringify({ url: websiteUrl }),
      });
    }
    if (context === "anonymous") {
      if (!anonId) {
        throw new Error("Unable to initialize your website analysis.");
      }
      return anonymousFetch<WebsiteScrapeStatus>("/discovery/scrape/anonymous", {
        method: "POST",
        body: JSON.stringify({ url: websiteUrl, anonId }),
      });
    }

    return apiFetch<WebsiteScrapeStatus>("/discovery/scrape", {
      method: "POST",
      body: JSON.stringify({ url: websiteUrl }),
    });
  }

  async function fetchAndMaybeStartStatus(
    forceStart: boolean,
    restartCompleted: boolean,
    version: number,
  ): Promise<WebsiteScrapeStatus> {
    let websiteUrl = syncStoredWebsiteUrl();
    if (!websiteUrl && context === "anonymous") {
      updateStore({ ready: true });
      return store.status;
    }

    const anonId = context === "anonymous" ? readOrCreateAnonymousScrapeId() : null;
    const scope = currentScope();
    const isCurrentRequest = () => version === requestVersion && scope === currentScope();
    updateStore({ loading: true, message: null });

    try {
      let nextStatus = await getStatus(anonId);
      if (!isCurrentRequest()) return store.status;

      if (!websiteUrl) {
        if (!nextStatus.url) {
          updateStore({
            status: nextStatus,
            loading: false,
            ready: true,
            message: nextStatus.status === "failed" ? nextStatus.error : NO_WEBSITE_MESSAGE,
            websiteUrl: null,
            hasStoredUrl: false,
          });
          return nextStatus;
        }
        websiteUrl = nextStatus.url;
        activeWebsiteUrl = websiteUrl;
        activeScope = scope;
      }

      const requestedStart =
        nextStatus.status !== "running" &&
        ((forceStart && (nextStatus.status !== "completed" || restartCompleted)) ||
          shouldStartFreshScrape(nextStatus, websiteUrl, startAttemptedForUrl));
      if (requestedStart) {
        nextStatus = await startScrape(websiteUrl, anonId);
      }

      if (!isCurrentRequest()) return store.status;
      const matchesSelectedWebsite = nextStatus.url &&
        cleanWebsiteDomain(nextStatus.url).toLowerCase() === cleanWebsiteDomain(websiteUrl).toLowerCase();
      if (!matchesSelectedWebsite) {
        // A held scrape lock can return the previous website's result. Keep
        // polling until the selected website's analysis can actually start.
        startAttemptedForUrl = null;
        nextStatus = { ...EMPTY_STATUS, status: "running", url: websiteUrl };
      } else if (requestedStart) {
        startAttemptedForUrl = websiteUrl;
      }

      updateStore({
        status: nextStatus,
        loading: false,
        ready: true,
        message: nextStatus.status === "failed" ? nextStatus.error : null,
        websiteUrl,
        hasStoredUrl: true,
      });
      persistScrapeStatus(nextStatus, anonId);

      if (context === "authenticated" && getDiscoveryOrgScope() && nextStatus.url) {
        window.localStorage.removeItem("lr_website_url");
      }

      if (nextStatus.status === "running") {
        schedulePoll();
      }

      return nextStatus;
    } catch (error) {
      if (!isCurrentRequest()) return store.status;
      const isAuthError = error instanceof ApiError && error.status === 401;
      const message =
        isAuthError && context === "authenticated"
          ? "Sign in to start analyzing your website insights."
          : error instanceof Error
            ? error.message
            : "Unable to load website insights.";

      updateStore({
        status: isAuthError
          ? store.status
          : {
              ...EMPTY_STATUS,
              status: "failed",
              url: websiteUrl,
              error: message,
            },
        loading: false,
        ready: true,
        message,
        websiteUrl,
        hasStoredUrl: true,
      });
      return store.status;
    }
  }

  async function ensureWebsiteScrapeStarted({
    force = false,
    restartCompleted = false,
    websiteUrl: selectedWebsiteUrl,
  }: EnsureScrapeOptions = {}): Promise<WebsiteScrapeStatus> {
    if (selectedWebsiteUrl) selectWebsiteUrl(selectedWebsiteUrl);
    const websiteUrl = syncStoredWebsiteUrl();
    const scope = currentScope();
    if (statusRequest && statusRequestUrl === websiteUrl && statusRequestScope === scope) {
      return statusRequest;
    }

    const request = fetchAndMaybeStartStatus(force, restartCompleted, ++requestVersion);
    statusRequest = request;
    statusRequestUrl = websiteUrl;
    statusRequestScope = currentScope();
    request.then(
      () => {
        if (statusRequest === request) {
          statusRequest = null;
          statusRequestUrl = null;
          statusRequestScope = null;
        }
      },
      () => {
        if (statusRequest === request) {
          statusRequest = null;
          statusRequestUrl = null;
          statusRequestScope = null;
        }
      },
    );

    return statusRequest;
  }

  function subscribe(listener: (nextStore: WebsiteScrapeStore) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function isReadyToLeave(storeSnapshot: WebsiteScrapeStore): boolean {
    return (
      !storeSnapshot.hasStoredUrl ||
      isWebsiteScrapeTerminal(storeSnapshot.status)
    );
  }

  async function waitForReadyToNavigate(
    maxWaitMs = 5000,
  ): Promise<WebsiteScrapeStatus> {
    const websiteUrl = syncStoredWebsiteUrl();
    if (!websiteUrl) {
      return store.status;
    }

    return new Promise<WebsiteScrapeStatus>((resolve) => {
      let settled = false;
      let unsubscribe = () => {};

      const finish = (status: WebsiteScrapeStatus) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(status);
      };

      const timeout = window.setTimeout(() => {
        finish(store.status);
      }, maxWaitMs);

      void ensureWebsiteScrapeStarted({ force: true }).then(
        () => {
          if (settled) return;
          if (isReadyToLeave(store)) {
            finish(store.status);
            return;
          }

          unsubscribe = subscribe((nextStore) => {
            if (isReadyToLeave(nextStore)) finish(nextStore.status);
          });

          if (isReadyToLeave(store)) finish(store.status);
        },
        () => finish(store.status),
      );
    });
  }

  return {
    ensureWebsiteScrapeStarted,
    retry: (websiteUrl?: string) => ensureWebsiteScrapeStarted({ force: true, restartCompleted: true, websiteUrl }),
    getSnapshot: () => store,
    subscribe,
    waitForReadyToNavigate,
  };
}

const anonymousScrapeController = createScrapeController("anonymous");
const authenticatedScrapeController = createScrapeController("authenticated");

export function useWebsiteScrapeStatus({
  autoStart = true,
  context = "anonymous",
}: UseWebsiteScrapeStatusOptions = {}) {
  const controller =
    context === "anonymous" ? anonymousScrapeController : authenticatedScrapeController;
  const [snapshot, setSnapshot] = useState<WebsiteScrapeStore>(() =>
    controller.getSnapshot(),
  );

  useEffect(() => {
    return controller.subscribe(setSnapshot);
  }, [controller]);

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    void controller.ensureWebsiteScrapeStarted();
  }, [autoStart, controller]);

  const start = useCallback(
    (websiteUrl?: string) => controller.ensureWebsiteScrapeStarted({ websiteUrl }),
    [controller],
  );

  const retry = useCallback(
    (websiteUrl?: string) => controller.retry(websiteUrl),
    [controller],
  );

  const waitForReadyToNavigate = useCallback(
    (maxWaitMs = 5000) => controller.waitForReadyToNavigate(maxWaitMs),
    [controller],
  );

  return {
    status: snapshot.status,
    loading: snapshot.loading,
    ready: snapshot.ready,
    message: snapshot.message,
    websiteUrl: snapshot.websiteUrl,
    hasStoredUrl: snapshot.hasStoredUrl,
    start,
    retry,
    waitForReadyToNavigate,
  };
}
