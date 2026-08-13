"use client";

import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

type FindProspectsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScraped: () => Promise<void> | void;
};

export function FindProspects({ open, onOpenChange, onScraped }: FindProspectsProps) {
  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [keywords, setKeywords] = useState("");
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [maxResults, setMaxResults] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const titles = splitList(jobTitles);
    if (titles.length === 0 && !searchUrl.trim()) {
      setError("Add at least one job title or paste a LinkedIn people search URL.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ imported: number; skipped: number; total: number }>(
        "/prospects/search",
        {
          method: "POST",
          body: JSON.stringify({
            filters: {
              jobTitles: titles,
              locations: splitList(locations),
              keywords: splitList(keywords),
              industries: splitList(industries),
              companySizes: splitList(companySizes),
            },
            maxResults: Math.min(50, Math.max(1, Number.parseInt(maxResults, 10) || 25)),
            ...(searchUrl.trim() && { searchUrl: searchUrl.trim() }),
          }),
        },
      );
      toast.success(
        `Found ${result.total} profile${result.total === 1 ? "" : "s"} · imported ${result.imported}${result.skipped ? ` · skipped ${result.skipped}` : ""}`,
      );
      onOpenChange(false);
      await onScraped();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to scrape prospects.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] max-w-lg flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Find prospects</DialogTitle>
            <DialogDescription>
              Search through your connected LinkedIn account. Results land in Prospects as pending review before enrollment.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              LinkedIn search URL <span className="font-normal text-muted-foreground">(optional)</span>
              <Input
                value={searchUrl}
                onChange={(event) => setSearchUrl(event.target.value)}
                placeholder="https://www.linkedin.com/search/results/people?..."
              />
            </label>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or build a search with filters
              <span className="h-px flex-1 bg-border" />
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Job titles
              <Input
                value={jobTitles}
                onChange={(event) => setJobTitles(event.target.value)}
                placeholder="Founder, Head of Growth"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Locations
              <Input
                value={locations}
                onChange={(event) => setLocations(event.target.value)}
                placeholder="United States, London"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Keywords
              <Input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="B2B, SaaS"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Industries
                <Input
                  value={industries}
                  onChange={(event) => setIndustries(event.target.value)}
                  placeholder="Software"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Company sizes
                <Input
                  value={companySizes}
                  onChange={(event) => setCompanySizes(event.target.value)}
                  placeholder="11-50, 51-200"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Max results
              <Input
                type="number"
                min={1}
                max={50}
                value={maxResults}
                onChange={(event) => setMaxResults(event.target.value)}
              />
            </label>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="min-h-10 sm:min-h-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" className="min-h-10 sm:min-h-8" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Search />}
            {isSaving ? "Searching…" : "Search LinkedIn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
