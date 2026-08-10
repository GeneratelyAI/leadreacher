"use client";

import { Info, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";

type OutreachMessageResponse = {
  message: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type ResolvedOutreachMessage = OutreachMessageResponse & { message: string };

const messageLoadRequests = new Map<string, Promise<ResolvedOutreachMessage>>();

function getOrGenerateMessage(orgId: string): Promise<ResolvedOutreachMessage> {
  const activeRequest = messageLoadRequests.get(orgId);
  if (activeRequest) return activeRequest;

  const request = (async () => {
    const persisted = await apiFetch<OutreachMessageResponse>(
      `/strategy/${orgId}/outreach-message`,
    );
    if (persisted.message) {
      return { ...persisted, message: persisted.message };
    }

    const generated = await apiFetch<OutreachMessageResponse>(
      `/strategy/${orgId}/outreach-message`,
      { method: "POST" },
    );
    if (!generated.message) {
      throw new Error("The generated outreach message was empty.");
    }
    return { ...generated, message: generated.message };
  })();

  messageLoadRequests.set(orgId, request);
  void request.then(
    () => {
      if (messageLoadRequests.get(orgId) === request) messageLoadRequests.delete(orgId);
    },
    () => {
      if (messageLoadRequests.get(orgId) === request) messageLoadRequests.delete(orgId);
    },
  );
  return request;
}

export function MessageReview({ orgId }: { orgId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [draftCtaLabel, setDraftCtaLabel] = useState("");
  const [draftCtaUrl, setDraftCtaUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setError(null);
    setMessage(null);
    let cancelled = false;
    async function run() {
      try {
        const result = await getOrGenerateMessage(orgId);
        if (!cancelled) {
          setMessage(result.message);
          setDraft(result.message);
          setCtaLabel(result.ctaLabel ?? "");
          setCtaUrl(result.ctaUrl ?? "");
          setDraftCtaLabel(result.ctaLabel ?? "");
          setDraftCtaUrl(result.ctaUrl ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to generate your outreach message.",
          );
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadToken]);

  async function saveMessage() {
    const trimmedMessage = draft.trim();
    const trimmedCtaLabel = draftCtaLabel.trim();
    const trimmedCtaUrl = draftCtaUrl.trim();
    const hasCta = Boolean(trimmedCtaLabel || trimmedCtaUrl);
    const hasChanges =
      trimmedMessage !== message ||
      trimmedCtaLabel !== ctaLabel ||
      trimmedCtaUrl !== ctaUrl;

    if (!trimmedMessage || isSaving) {
      return;
    }
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<ResolvedOutreachMessage>(
        `/strategy/${orgId}/outreach-message`,
        {
          method: "PATCH",
          body: JSON.stringify({
            message: trimmedMessage,
            ctaLabel: hasCta ? trimmedCtaLabel || null : null,
            ctaUrl: hasCta ? trimmedCtaUrl || null : null,
          }),
        },
      );
      setMessage(result.message);
      setDraft(result.message);
      setCtaLabel(result.ctaLabel ?? "");
      setCtaUrl(result.ctaUrl ?? "");
      setDraftCtaLabel(result.ctaLabel ?? "");
      setDraftCtaUrl(result.ctaUrl ?? "");
      setIsEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your outreach message.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OnboardingCard className="px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
            Review your message and CTA
          </h2>
          <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-xs font-medium text-onboarding-purple-700 dark:bg-onboarding-purple-900/30 dark:text-onboarding-purple-200">
            AI generated
          </span>
        </div>
        {message && !isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-onboarding-purple-600 hover:text-onboarding-purple-700 dark:text-onboarding-purple-200"
          >
            <Pencil className="size-4" aria-hidden />
            Edit message
          </Button>
        ) : null}
      </div>

      {message === null && !error ? (
        <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-3 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          <Loader2 className="size-5 animate-spin text-onboarding-purple-500" aria-hidden />
          Generating your outreach message
        </div>
      ) : null}

      {message !== null ? (
        <div className="mt-5 rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 py-4 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900/40">
          {isEditing ? (
            <div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={1000}
                rows={7}
                className="w-full resize-y bg-transparent text-sm leading-6 text-onboarding-ink outline-none dark:text-onboarding-neutral-0"
                aria-label="Outreach message"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                  CTA label
                  <Input
                    value={draftCtaLabel}
                    onChange={(event) => setDraftCtaLabel(event.target.value)}
                    maxLength={80}
                    placeholder="Book a short call"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                  CTA destination URL
                  <Input
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={draftCtaUrl}
                    onChange={(event) => setDraftCtaUrl(event.target.value)}
                    placeholder="https://yourcompany.com/demo"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                Add both fields to include a direct, trackable link in the outreach message.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                  {draft.length} characters
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => {
                      setDraft(message);
                      setDraftCtaLabel(ctaLabel);
                      setDraftCtaUrl(ctaUrl);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    disabled={!draft.trim() || isSaving || Boolean(draftCtaLabel.trim()) !== Boolean(draftCtaUrl.trim())}
                    onClick={() => void saveMessage()}
                  >
                    {isSaving ? "Saving..." : "Save message"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-36 pr-24">
              <p className="break-words whitespace-pre-line text-sm leading-6 text-onboarding-ink dark:text-onboarding-neutral-0">
                {message}
              </p>
              {ctaLabel && ctaUrl ? (
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex max-w-full break-all text-sm font-semibold text-onboarding-purple-600 underline decoration-onboarding-purple-300 underline-offset-4 dark:text-onboarding-purple-200"
                >
                  {ctaLabel}: {ctaUrl}
                </a>
              ) : null}
              <span className="absolute bottom-0 right-0 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                {message.length} characters
              </span>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-onboarding-error-900 dark:text-onboarding-error-50">{error}</p>
          {message === null ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        <Info className="size-4 shrink-0" aria-hidden />
        This message and CTA are reviewed before they are sent to prospects.
      </p>
    </OnboardingCard>
  );
}
