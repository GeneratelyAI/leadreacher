"use client";

import { ExternalLink, Loader2, Plus, Search } from "@/components/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { ApiError, apiFetch } from "@/lib/api";

const SEARCH_RESULT_LIMIT = 8;
const ACCOUNT_STATUS_POLL_INTERVAL_MS = 2_000;
const SEARCH_DEBOUNCE_MS = 400;
const MINIMUM_SEARCH_LENGTH = 2;

type SocialAccount = {
  id: string;
  platform: string;
  accountName: string;
  status: string;
};

type SocialAccountsResponse = {
  accounts: SocialAccount[];
};

type ProspectProfile = {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  location?: string;
  industry?: string;
  companySize?: string;
  email?: string;
  phone?: string;
  publicIdentifier?: string;
  providerLinkedinId?: string;
  avatarUrl?: string;
  enrichmentData: Record<string, unknown>;
};

type AddProspectProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<void> | void;
};

function initials(profile: ProspectProfile): string {
  return `${profile.firstName} ${profile.lastName}`
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function profileDescription(profile: ProspectProfile): string {
  return [profile.title, profile.company, profile.location].filter(Boolean).join(" · ");
}

function isUsableLinkedInProfileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const identifier = url.pathname.match(/^\/in\/([^/]+)/i)?.[1];
    return url.protocol === "https:" && url.hostname.endsWith("linkedin.com") && identifier !== undefined && !["undefined", "null"].includes(identifier.toLowerCase());
  } catch {
    return false;
  }
}

function uniqueProfiles(profiles: ProspectProfile[]): ProspectProfile[] {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (!isUsableLinkedInProfileUrl(profile.linkedinUrl)) return false;
    const identifier = profile.providerLinkedinId || profile.linkedinUrl;
    if (seen.has(identifier)) return false;
    seen.add(identifier);
    return true;
  });
}

export function AddProspect({
  open,
  onOpenChange,
  onAdded,
}: AddProspectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProspectProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const accountsQuery = useQuery({
    queryKey: ["social-accounts", "prospect-search"],
    queryFn: () => apiFetch<SocialAccountsResponse>("/social-accounts"),
    enabled: open,
    refetchInterval: (query) => {
      const hasActiveLinkedIn = query.state.data?.accounts.some(
        (account) => account.platform.toLowerCase() === "linkedin" && account.status === "active",
      );
      return hasActiveLinkedIn ? false : ACCOUNT_STATUS_POLL_INTERVAL_MS;
    },
  });
  const activeLinkedInAccount = accountsQuery.data?.accounts.find(
    (account) => account.platform.toLowerCase() === "linkedin" && account.status === "active",
  );
  const isCheckingLinkedIn = accountsQuery.isLoading || accountsQuery.isFetching;
  const canSearch = Boolean(activeLinkedInAccount);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setResults([]);
      setHasSearched(false);
    }
  }
  const [addingProfileUrl, setAddingProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    const keyword = query.trim();
    if (!open || !canSearch || keyword.length < MINIMUM_SEARCH_LENGTH) {
      setIsSearching(false);
      if (keyword.length < MINIMUM_SEARCH_LENGTH) {
        setResults([]);
        setError(null);
        setHasSearched(false);
      }
      return;
    }

    let current = true;
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      setHasSearched(true);
      try {
        const result = await apiFetch<{ profiles: ProspectProfile[] }>(
          "/prospects/search/preview",
          {
            method: "POST",
            body: JSON.stringify({
              filters: {
                jobTitles: [],
                industries: [],
                companySizes: [],
                locations: [],
                keywords: [keyword],
              },
              maxResults: SEARCH_RESULT_LIMIT,
            }),
          },
        );
        if (current) setResults(uniqueProfiles(result.profiles));
      } catch (requestError) {
        if (current) {
          setResults([]);
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to search LinkedIn right now.",
          );
        }
      } finally {
        if (current) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [canSearch, open, query]);

  async function addProspect(profile: ProspectProfile) {
    setAddingProfileUrl(profile.linkedinUrl);
    setError(null);
    try {
      const result = await apiFetch<{ imported: number; skipped: number }>(
        "/prospects/import",
        {
          method: "POST",
          body: JSON.stringify({ profile }),
        },
      );
      toast.success(
        result.imported
          ? `${profile.firstName} ${profile.lastName} was added for review.`
          : `${profile.firstName} ${profile.lastName} is already in your prospects.`,
      );
      handleOpenChange(false);
      await onAdded();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to add this prospect.",
      );
    } finally {
      setAddingProfileUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,44rem)] max-w-xl flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Add a prospect</DialogTitle>
            <DialogDescription>
              {activeLinkedInAccount
                ? `Searching as ${activeLinkedInAccount.accountName}. Add one person for review.`
                : "Connect LinkedIn to search and add one person for review."}
            </DialogDescription>
          </DialogHeader>

          {canSearch ? (
            <div className="relative">
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Name, title, company, or keyword"
                aria-label="Search LinkedIn prospects"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground" aria-hidden>
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </div>
              <span className="sr-only" aria-live="polite">
                {isSearching ? "Searching LinkedIn" : ""}
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground" aria-live="polite">
              <p className="font-medium text-foreground">
                {isCheckingLinkedIn ? "Checking your LinkedIn connection..." : "LinkedIn is not ready for search."}
              </p>
              <p className="mt-1">
                {isCheckingLinkedIn
                  ? "The search will appear here as soon as the connected account becomes active."
                  : "Connect or reconnect the account in Channels, then this dialog will update automatically."}
              </p>
            </div>
          )}

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {results.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {results.map((profile) => {
                const name = `${profile.firstName} ${profile.lastName}`;
                const isAdding = addingProfileUrl === profile.linkedinUrl;
                return (
                  <li key={profile.providerLinkedinId || profile.linkedinUrl} className="flex items-center gap-3 p-3">
                    <Avatar className="size-10">
                      {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initials(profile)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profileDescription(profile) || "LinkedIn profile"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={profile.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${name}'s LinkedIn profile`}
                        >
                          <ExternalLink />
                        </a>
                      </Button>
                      <Button
                        variant="brand"
                        size="sm"
                        disabled={addingProfileUrl !== null}
                        onClick={() => void addProspect(profile)}
                      >
                        {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
                        {isAdding ? "Adding" : "Add"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {hasSearched && !isSearching && !error && results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No prospects found. Try a broader title, company, or keyword.
            </p>
          ) : null}
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="min-h-10 sm:min-h-8" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
