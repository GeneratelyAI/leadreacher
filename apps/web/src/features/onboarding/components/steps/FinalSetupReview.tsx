"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Info, Users } from "@/components/ui/icons";
import { ChannelLogo } from "@/platform/branding/ChannelLogo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { navigateOnboarding, onboardingHref } from "../../public/navigation";
import type { SetupReviewItem } from "./setup-review";
import continuation from "../continuation/Continuation.module.css";
import styles from "./ChannelsMobile.module.css";

const icons = {
  audience: <Users aria-hidden />,
  content: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3Z" />
    </svg>
  ),
  style: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z" />
    </svg>
  ),
  channels: <ChannelLogo name="linkedin" />,
};

export function FinalSetupReview({
  items,
  isLoading,
  isCompleting,
  canComplete,
  error,
  completedCampaignId,
  onComplete,
  onBack,
}: {
  items: SetupReviewItem[];
  isLoading: boolean;
  isCompleting: boolean;
  canComplete: boolean;
  error: string | null;
  completedCampaignId: string | null;
  onComplete: () => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const hasSavedDetails = items.length > 0;
  const title = completedCampaignId
    ? "Your draft is ready"
    : isLoading || hasSavedDetails
      ? "Ready for your review"
      : "Review your setup";

  return (
    <section className={`onboarding-page ${continuation.page} ${continuation.responsiveTaskPage} ${styles.screen}`}>
      <main className={`continuation-main ${continuation.main} ${continuation.reviewMain}`} aria-busy={isLoading || isCompleting}>
      <header className={continuation.heading}>
        <h1 ref={heading} tabIndex={-1}>
          {title}<span className="signup-campaign-period">.</span>
        </h1>
        <p>
          {completedCampaignId
            ? "Preview campaign draft prepared."
            : isLoading || hasSavedDetails
              ? "Your setup is ready to review."
              : "Your saved setup is unavailable."}{" "}
          Nothing has been sent.
        </p>
      </header>
      <div className="onboarding-scene-task-scroll" role="region" aria-label="Campaign review content" tabIndex={0}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!isLoading && !hasSavedDetails ? (
          <Alert tone="warning">
            We couldn&apos;t load your campaign decisions. Return to setup to try
            again.
          </Alert>
        ) : null}
        {isLoading ? (
          <p role="status" className={styles.reviewLoading}>
            Loading your saved campaign...
          </p>
        ) : (
          <div className={`${continuation.card} ${styles.reviewItems}`}>
            {items.map((item) => (
              <div key={item.key} className={styles.reviewItem}>
                <span className={styles.reviewIcon}>{icons[item.key]}</span>
                <div className={styles.reviewValue}>
                  <h2>{item.label}</h2>
                  <p>{item.value}</p>
                </div>
                <button
                  type="button"
                  className={styles.edit}
                  aria-label={`Edit ${item.label.toLowerCase()}`}
                  onClick={() => navigateOnboarding(onboardingHref(item.step))}
                >
                  Edit
                  <ChevronRight aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className={styles.notice}>
          <Info aria-hidden />
          <span>Review your prospects and messages before launching.</span>
        </p>
        {completedCampaignId ? (
          <p className={styles.previewComplete} role="status">
            Local preview only. Campaign ID: {completedCampaignId}. No campaign
            was launched.
          </p>
        ) : null}
      </div>
      </main>
      <footer className={`onboarding-campaign-action-row ${styles.actions}`}>
        <div><Button type="button" variant="secondary" className="campaign-content-back" onClick={onBack}><ArrowLeft aria-hidden />Back</Button></div>
        {!completedCampaignId ? <div><Button type="button" variant="primary" className="onboarding-campaign-next" disabled={!canComplete || isLoading || isCompleting} onClick={onComplete}>{isCompleting ? "Preparing your draft..." : "Open campaign draft"}<ArrowRight aria-hidden /></Button></div> : null}
      </footer>
    </section>
  );
}
