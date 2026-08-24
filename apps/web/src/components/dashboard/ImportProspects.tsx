"use client";

import { Loader2, Upload } from "@/components/ui/icons";
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
import { ApiError, apiFetch } from "@/lib/api";

type CsvRow = {
  firstName: string;
  lastName: string;
  linkedinUrl?: string;
  email?: string;
  company?: string;
  title?: string;
  location?: string;
  phone?: string;
  instagramUsername?: string;
  whatsappConsentAt?: string;
  whatsappConsentSource?: string;
};

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  firstname: "firstName",
  first_name: "firstName",
  "first name": "firstName",
  lastname: "lastName",
  last_name: "lastName",
  "last name": "lastName",
  linkedinurl: "linkedinUrl",
  linkedin_url: "linkedinUrl",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  email: "email",
  company: "company",
  title: "title",
  jobtitle: "title",
  job_title: "title",
  location: "location",
  phone: "phone",
  mobile: "phone",
  instagram: "instagramUsername",
  instagramusername: "instagramUsername",
  instagram_username: "instagramUsername",
  "instagram username": "instagramUsername",
  whatsappconsentat: "whatsappConsentAt",
  whatsapp_consent_at: "whatsappConsentAt",
  "whatsapp consent at": "whatsappConsentAt",
  whatsappconsentsource: "whatsappConsentSource",
  whatsapp_consent_source: "whatsappConsentSource",
  "whatsapp consent source": "whatsappConsentSource",
};

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }

  const headers = splitCsvLine(lines[0]!).map((header) => header.trim().toLowerCase());
  const mapped = headers.map((header) => HEADER_ALIASES[header] ?? null);
  if (!mapped.includes("firstName") || !mapped.includes("lastName")) {
    throw new Error("CSV must include firstName and lastName columns.");
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row: CsvRow = { firstName: "", lastName: "" };
    mapped.forEach((key, cellIndex) => {
      if (!key) return;
      const value = cells[cellIndex]?.trim();
      if (value) row[key] = value;
    });
    if (!row.firstName || !row.lastName) {
      throw new Error(`Row ${index + 2} is missing firstName or lastName.`);
    }
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

type ImportProspectsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
};

export function ImportProspects({ open, onOpenChange, onImported }: ImportProspectsProps) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onFileChange(file: File | null) {
    setError(null);
    setRows([]);
    setFileName(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setFileName(file.name);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Unable to parse CSV.");
    }
  }

  async function submit() {
    if (rows.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ imported: number; skipped: number; total: number }>(
        "/leads/import/csv",
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      toast.success(`Imported ${result.imported} prospect${result.imported === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} skipped)` : ""}`);
      setRows([]);
      setFileName(null);
      onOpenChange(false);
      await onImported();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to import CSV.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,36rem)] max-w-lg flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              Required columns: firstName, lastName. Optional: linkedinUrl, instagramUsername, email, phone, company, title, location. WhatsApp outreach also requires whatsappConsentAt (ISO timestamp) and whatsappConsentSource.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm transition-colors hover:bg-muted/40">
            <Upload className="size-5 text-muted-foreground" aria-hidden />
            <span className="font-medium">{fileName ?? "Choose a CSV file"}</span>
            <span className="text-xs text-muted-foreground">
              {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? "" : "s"} ready` : "Up to a few hundred rows works best"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="min-h-10 sm:min-h-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" className="min-h-10 sm:min-h-8" disabled={rows.length === 0 || isSaving} onClick={() => void submit()}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            Import {rows.length > 0 ? rows.length : ""} prospects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
