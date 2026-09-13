"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, FileText, Upload, X } from "@/components/ui/icons";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { beginOnboardingNavigation, navigateOnboarding, onboardingHref, restoreOnboardingNavigation } from "../../public/navigation";
import { continueAfterContent } from "../../public/content-next";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usesOnboardingFixtures } from "@/features/onboarding/public/preview-api";
import { FilePreviewIllustration } from "./CreativeIllustrations";
import mobile from "./CreativeMobile.module.css";

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
  size?: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export default function UploadDocument({ preview = false, selectedFileFixture = false }: { preview?: boolean; selectedFileFixture?: boolean }) {
  useLayoutEffect(() => applyStoredTheme(), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(() => preview && selectedFileFixture ? {
    name: "Acme-growth-services-overview.pdf",
    size: Math.round(2.4 * 1024 * 1024),
  } : null);
  const [isDragging, setIsDragging] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const strategy = await apiFetch<{ icpDefinition?: { approvedContent?: { type?: unknown; documentName?: unknown; documentSize?: unknown } } }>(`/strategy/${orgId}`);
        const approved = strategy.icpDefinition?.approvedContent;
        if (!cancelled && approved?.type === "Document" && typeof approved.documentName === "string" && approved.documentName.trim()) {
          setSelectedDocument((current) => current ?? { name: approved.documentName as string, size: typeof approved.documentSize === "number" && approved.documentSize >= 0 ? approved.documentSize : undefined });
        }
      } catch {
        // The document picker remains available when saved metadata cannot be restored.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function clearSelection() {
    setSelectedDocument(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectDocument(file: File | undefined) {
    if (!file || approved) return;

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
    <section className={cn("upload-document-page", mobile.page)}>
      <main className="upload-document-main" aria-labelledby="upload-document-title">
        <header className="upload-document-header">
          <h1 id="upload-document-title">
            <span className={mobile.desktopOnly}>Add your document<span className="signup-campaign-period">.</span></span>
            <span className={mobile.mobileOnly}>Give them something worth opening<span className="signup-campaign-period">.</span></span>
          </h1>
          <p><span className={mobile.desktopOnly}>Give prospects something worth opening.</span><span className={mobile.mobileOnly}>Share a useful deck, brochure, or PDF.</span></p>
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
              <div className={mobile.filePreview} aria-label="Document file illustration, not a content preview"><FilePreviewIllustration document /></div>
              <div className="upload-document-file-details">
                <FileText className={cn("upload-document-file-icon", mobile.desktopOnly)} weight="fill" aria-hidden />
                <FilePreviewIllustration document className={cn("upload-document-file-icon", mobile.mobileOnly)} />
                <div>
                  <p>{selectedDocument.name}</p>
                  <span>{[selectedDocument.name.split(".").pop()?.toUpperCase(), selectedDocument.size === undefined ? undefined : formatBytes(selectedDocument.size)].filter(Boolean).join(" · ")}</span>
                </div>
                <Button type="button" variant="secondary" className="upload-document-remove" disabled={approved} onClick={clearSelection}>
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              </div>
              <Button type="button" variant="secondary" className={mobile.fileReplace} disabled={approved} onClick={() => inputRef.current?.click()}><Upload className="size-4" aria-hidden />Choose another file</Button>
              <p className={mobile.documentStorageNotice}>{preview ? "Sample document selected for this preview. No file is stored or sent." : "Document storage is not available yet. This file is selected on your device only and cannot be included in a campaign."}</p>
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
          disabled={!selectedDocument || approved || !preview}
          onClick={async () => {
            if (!preview || !usesOnboardingFixtures()) return;
            if (!beginOnboardingNavigation(onboardingHref("cta"))) return;
            setApproved(true);
            try {
              const { orgId } = await bootstrapCurrentOrganization();
              await apiFetch(`/strategy/${orgId}/content-approval`, { method: "PATCH", body: JSON.stringify({ type: "Document", documentName: selectedDocument?.name, documentSize: selectedDocument?.size }) });
              continueAfterContent();
            } catch (caught) {
              restoreOnboardingNavigation();
              setApproved(false);
              setError(caught instanceof Error ? caught.message : "Unable to save your content selection. Please try again.");
            }
          }}
        >
          <span className={mobile.desktopOnly}>Continue</span><span className={mobile.mobileOnly}>Use this document</span>
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

    </section>
  );
}
