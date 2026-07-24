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

type ScrapeProspectsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScraped: () => Promise<void> | void;
};

export function ScrapeProspectsModal({ open, onOpenChange, onScraped }: ScrapeProspectsModalProps) {
  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [keywords, setKeywords] = useState("");
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState("");
  const [maxResults, setMaxResults] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const titles = splitList(jobTitles);
    if (titles.length === 0) {
      setError("Add at least one job title.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ imported: number; skipped: number; total: number }>(
        "/leads/scrape",
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
            maxResults: Math.min(100, Math.max(1, Number.parseInt(maxResults, 10) || 25)),
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Find prospects</DialogTitle>
          <DialogDescription>
            Run an ICP LinkedIn search. Results land in Prospects as pending review before enrollment.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3">
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
              max={100}
              value={maxResults}
              onChange={(event) => setMaxResults(event.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Search />}
            {isSaving ? "Searching…" : "Search LinkedIn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
