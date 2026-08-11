"use client";

import { ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
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

type SearchProspectModalProps = {
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

export function SearchProspectModal({
  open,
  onOpenChange,
  onAdded,
}: SearchProspectModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProspectProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setResults([]);
      setHasSearched(false);
    }
  }
  const [addingProfileUrl, setAddingProfileUrl] = useState<string | null>(null);

  async function searchProspects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setError("Enter a name, title, company, or keyword to search LinkedIn.");
      return;
    }

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
      setResults(result.profiles);
    } catch (requestError) {
      setResults([]);
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to search LinkedIn right now.",
      );
    } finally {
      setIsSearching(false);
    }
  }

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
              Search your connected LinkedIn account, then add one person for review.
            </DialogDescription>
          </DialogHeader>

          <form className="flex gap-2" onSubmit={(event) => void searchProspects(event)}>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHasSearched(false);
              }}
              placeholder="Name, title, company, or keyword"
              aria-label="Search LinkedIn prospects"
            />
            <Button type="submit" variant="brand" disabled={isSearching}>
              {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
              Search
            </Button>
          </form>

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
                  <li key={profile.linkedinUrl} className="flex items-center gap-3 p-3">
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
