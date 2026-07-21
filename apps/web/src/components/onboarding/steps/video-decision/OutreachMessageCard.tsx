"use client";

import { Info, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

type OutreachMessageResponse = {
  message: string;
};

export function OutreachMessageCard({ orgId }: { orgId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessage() {
      try {
        const result = await apiFetch<OutreachMessageResponse>(
          `/strategy/${orgId}/outreach-message`,
          { method: "POST" },
        );
        if (!cancelled) {
          setMessage(result.message);
          setDraft(result.message);
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

    void loadMessage();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function saveMessage() {
    const trimmedMessage = draft.trim();
    if (!trimmedMessage || trimmedMessage === message || isSaving) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<OutreachMessageResponse>(
        `/strategy/${orgId}/outreach-message`,
        {
          method: "PATCH",
          body: JSON.stringify({ message: trimmedMessage }),
        },
      );
      setMessage(result.message);
      setDraft(result.message);
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
            Review your outreach message
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
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
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
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    disabled={!draft.trim() || isSaving}
                    onClick={() => void saveMessage()}
                  >
                    {isSaving ? "Saving..." : "Save message"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-36 pr-24">
              <p className="whitespace-pre-line text-sm leading-6 text-onboarding-ink dark:text-onboarding-neutral-0">
                {message}
              </p>
              <span className="absolute bottom-0 right-0 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                {message.length} characters
              </span>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-4 flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        <Info className="size-4 shrink-0" aria-hidden />
        This message will be personalized for each prospect.
      </p>
    </OnboardingCard>
  );
}
