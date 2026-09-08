"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createLiveCampaignSummary } from "@/components/onboarding/campaign-summary";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, FileText, Upload, X } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { navigateOnboarding, onboardingHref } from "./steps";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";

const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/msword",
];
const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".ppt", ".pptx", ".doc", ".docx"];

type SelectedDocument = {
  name: string;
  size: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export default function UploadDocument() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo(
    () => createLiveCampaignSummary(status, "chosen-content", { type: "Document" }, websiteUrl),
    [status, websiteUrl],
  );

  function clearSelection() {
    setSelectedDocument(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectDocument(file: File | undefined) {
    if (!file) return;

    const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    );
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type) && !hasAcceptedExtension) {
      setError("Choose a PDF, PowerPoint, or Word document.");
      return;
    }
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setError("Documents must be 25 MB or smaller.");
      return;
    }

    setSelectedDocument({ name: file.name, size: file.size });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="upload-document-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="upload-document-main" aria-labelledby="upload-document-title">
        <header className="upload-document-header">
          <h1 id="upload-document-title">
            Add your document<span className="signup-campaign-period">.</span>
          </h1>
          <p>Give prospects something worth opening.</p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/msword,.pdf,.ppt,.pptx,.doc,.docx"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => selectDocument(event.target.files?.[0])}
        />

        <section className="upload-document-section" aria-label="Campaign document upload">
          {selectedDocument ? (
            <div className="upload-document-selected">
              <div className="upload-document-file-details">
                <FileText className="upload-document-file-icon" weight="fill" aria-hidden />
                <div>
                  <p>{selectedDocument.name}</p>
                  <span>{formatBytes(selectedDocument.size)} · Ready to include</span>
                </div>
                <Button type="button" variant="secondary" className="upload-document-remove" onClick={clearSelection}>
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="upload-document-drop-zone"
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectDocument(event.dataTransfer.files[0]);
              }}
              data-dragging={isDragging || undefined}
            >
              <span className="upload-document-icon" aria-hidden>
                <Upload className="size-10" weight="bold" />
              </span>
              <p>Drag and drop your document here</p>
              <span>or</span>
              <Button type="button" variant="secondary" className="upload-document-browse" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
            </div>
          )}
          <p className="upload-document-helper">PDF, PowerPoint, or Word. Up to 25 MB.</p>
          {error ? <p className="upload-document-error" role="alert">{error}</p> : null}
        </section>
      </main>

      <div className="upload-document-actions">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}>
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          className="onboarding-campaign-next"
          disabled={!selectedDocument || approved}
          onClick={async () => {
            setApproved(true);
            try {
              const { orgId } = await bootstrapCurrentOrganization();
              await apiFetch(`/strategy/${orgId}/content-approval`, { method: "PATCH", body: JSON.stringify({ type: "Document", documentName: selectedDocument?.name }) });
              navigateOnboarding(onboardingHref("checkout"));
            } catch (caught) {
              setApproved(false);
              setError(caught instanceof Error ? caught.message : "Unable to save your content selection. Please try again.");
            }
          }}
        >
          Continue
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill campaign={campaign} className="signup-campaign-pill" />
      </aside>
    </section>
  );
}
