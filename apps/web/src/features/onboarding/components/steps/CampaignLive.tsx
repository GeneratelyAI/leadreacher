"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import styles from "./CampaignLive.module.css";

type PlaybackState = "loading" | "playing" | "settled" | "failed";

function dashboardHref(campaignId: string | null): string {
  if (!campaignId) return "/dashboard/campaigns";
  return `/dashboard/campaigns?${new URLSearchParams({ reviewCampaignId: campaignId }).toString()}`;
}

export default function CampaignLive() {
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const reducedMotion = useStableReducedMotion();
  const [motionPreferenceReady, setMotionPreferenceReady] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>("loading");
  const campaignId = searchParams.get("reviewCampaignId")?.trim() || null;

  useEffect(() => {
    setMotionPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!motionPreferenceReady || reducedMotion) return;
    const timer = window.setTimeout(() => {
      confettiRef.current?.fire({
        particleCount: 72,
        spread: 68,
        startVelocity: 38,
        scalar: 1.18,
        gravity: 0.76,
        ticks: 210,
        origin: { x: 0.5, y: 0.08 },
        colors: ["#7044f7", "#a78bfa", "#ffffff", "#87d9bf"],
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [motionPreferenceReady, reducedMotion]);

  useEffect(() => {
    if (!motionPreferenceReady) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const updateState = (state: PlaybackState) => {
      if (!cancelled) setPlayback(state);
    };
    const settle = () => updateState("settled");
    const showReducedMotionFrame = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      }
      settle();
    };
    const start = () => {
      if (reducedMotion) {
        showReducedMotionFrame();
        return;
      }
      video.playbackRate = 1.5;
      void video.play()
        .then(() => {
          updateState("playing");
        })
        .catch(() => updateState("failed"));
    };
    const fail = () => {
      video.pause();
      updateState("failed");
    };

    video.addEventListener("ended", settle);
    video.addEventListener("error", fail);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      start();
    } else {
      video.addEventListener("loadedmetadata", start, { once: true });
    }

    return () => {
      cancelled = true;
      video.pause();
      video.removeEventListener("ended", settle);
      video.removeEventListener("error", fail);
      video.removeEventListener("loadedmetadata", start);
    };
  }, [motionPreferenceReady, reducedMotion]);

  return (
    <div className={styles.screen} data-playback={playback}>
      <Link href="/" prefetch={false} aria-label="LeadReacher home" className={styles.brand}>
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>
      <Confetti
        ref={confettiRef}
        manualstart
        aria-hidden="true"
        className={styles.confetti}
      />
      <main className={styles.main}>
        <div className={styles.copy}>
          <div className={styles.planeStage} aria-hidden="true">
            <div className={styles.planeVisual}>
              <video
                ref={videoRef}
                className={styles.videoPlane}
                data-testid="live-launch-plane"
                suppressHydrationWarning
                muted
                playsInline
                preload="auto"
                loop={false}
                disablePictureInPicture
                tabIndex={-1}
                src="/animation/paper-plane.webm"
              />
            </div>
          </div>
          {playback === "failed" ? (
            <span className="sr-only" role="status">Campaign launch animation is unavailable.</span>
          ) : null}
          <h1 data-onboarding-focus>Your campaign is live<span className="signup-campaign-period">.</span></h1>
          <p>
            <span>We’re finding your ideal prospects now and getting everything ready for outreach.</span>
            <span>Your content will start reaching them shortly.</span>
          </p>
          <Link href={dashboardHref(campaignId)} className={styles.action} onClick={() => videoRef.current?.pause()}>
            View campaign
          </Link>
        </div>
      </main>
    </div>
  );
}
