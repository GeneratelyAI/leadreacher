"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import { useCampaignData } from "@/features/onboarding/public/pill";
import { SparklesIcon } from "@/components/ui/animated-highlight-text";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, CheckCircle2, Play } from "@/components/ui/icons";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { cn } from "@/lib/utils";
import { navigateOnboarding, onboardingHref } from "../../public/navigation";
import type { VideoTone } from "./video-style-types";
import {
  resolveVideoStylePreview,
  type GeneratedVideoPreview,
} from "./video-style-preview";
import mobile from "./CreativeMobile.module.css";

type StyleOption = {
  id: VideoTone;
  title: string;
  qualities: readonly string[];
  sampleImage: string;
  recommended?: boolean;
  description: string;
};

const STYLE_OPTIONS: readonly StyleOption[] = [
  {
    id: "professional",
    title: "Professional",
    qualities: ["Polished", "Credible", "Decision-maker focused"],
    sampleImage: "/landing/product-story/content-professional.webp",
    recommended: true,
    description: "Clear, confident, and direct.",
  },
  {
    id: "casual",
    title: "Casual",
    qualities: ["Natural", "Approachable", "Conversational"],
    sampleImage: "/landing/product-story/content-casual.webp",
    description: "Warm, approachable, and conversational.",
  },
  {
    id: "aggressive",
    title: "Aggressive",
    qualities: ["Direct", "High-energy", "Action-focused"],
    sampleImage: "/landing/product-story/content-aggressive.webp",
    description: "Bold, direct, and results-oriented.",
  },
];

type ContentAnimationPhase = "generating" | "ready" | "select" | "approved";

function reducedMotionPreferred(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function VideoStyleSelection({
  mode,
  styleLabel,
  preview: isPreviewMode = false,
  generatedPreviews,
  placeholderPreview = false,
  initialStyle,
}: {
  mode: "personalized" | "standardized";
  styleLabel: string;
  preview?: boolean;
  generatedPreviews?: Partial<Record<VideoTone, GeneratedVideoPreview>>;
  placeholderPreview?: boolean;
  initialStyle?: VideoTone;
}) {
  useLayoutEffect(() => applyStoredTheme(), []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const savedCampaign = useCampaignData();
  const savedContent = savedCampaign?.sections?.find((section) => section.id === "content")?.value;
  const savedContentStyle = STYLE_OPTIONS.find((option) => savedContent?.endsWith(` · ${option.title}`));
  const [selectedStyle, setSelectedStyle] = useState<VideoTone>(
    savedContentStyle?.id ?? (isPreviewMode && initialStyle ? initialStyle : "professional"),
  );
  const railRef = useRef<HTMLDivElement>(null);
  const [railIndex, setRailIndex] = useState(() => STYLE_OPTIONS.findIndex((option) => option.id === selectedStyle));
  function showStyle(index: number) {
    const rail = railRef.current;
    const card = rail?.children[index] as HTMLElement | undefined;
    if (!rail || !card) return;
    rail.scrollTo({ left: card.offsetLeft - (rail.children[0] as HTMLElement).offsetLeft, behavior: reducedMotionPreferred() ? "instant" : "smooth" });
    setRailIndex(index);
  }
  const hasChosenStyle = useRef(false);
  useLayoutEffect(() => {
    if (hasChosenStyle.current || !window.matchMedia("(max-width: 63rem)").matches) return;
    const index = STYLE_OPTIONS.findIndex((option) => option.id === selectedStyle);
    const rail = railRef.current;
    const card = rail?.children[index] as HTMLElement | undefined;
    const first = rail?.children[0] as HTMLElement | undefined;
    if (!rail || !card || !first) return;
    // Place restored selections before paint, using untransformed layout widths.
    rail.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: "instant" });
    setRailIndex(index);
  }, [selectedStyle]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const saved = await apiFetch<{ videoConfig?: { tone?: string } }>(`/strategy/${orgId}`);
        const tone = saved.videoConfig?.tone ?? (isPreviewMode ? initialStyle : undefined);
        const index = STYLE_OPTIONS.findIndex((option) => option.id === tone);
        if (cancelled || hasChosenStyle.current || index < 0) return;
        setSelectedStyle(STYLE_OPTIONS[index].id);
      } catch { /* Keep the default when there is no saved style. */ }
    })();
    return () => { cancelled = true; };
  }, [initialStyle, isPreviewMode]);
  useEffect(() => {
    if (hasChosenStyle.current || !savedContent) return;
    const savedStyle = STYLE_OPTIONS.find((option) => savedContent.endsWith(` · ${option.title}`));
    if (savedStyle) setSelectedStyle(savedStyle.id);
  }, [savedContent]);
  const [unavailablePreviewIds, setUnavailablePreviewIds] = useState<Set<VideoTone>>(() => new Set());
  const hasGeneratedPreview = STYLE_OPTIONS.some((option) => {
    const asset = generatedPreviews?.[option.id];
    return !unavailablePreviewIds.has(option.id) && Boolean(asset?.videoUrl || asset?.posterUrl);
  });
  const [phase, setPhase] = useState<ContentAnimationPhase>(() => (
    (isPreviewMode && !placeholderPreview) || hasGeneratedPreview ? "generating" : "select"
  ));
  const [loadedPreviews, setLoadedPreviews] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSignature = JSON.stringify(generatedPreviews ?? {});
  const resolvedPreviews = useMemo(() => STYLE_OPTIONS.map((option) => {
    return {
      option,
      preview: resolveVideoStylePreview({
        sampleImage: option.sampleImage,
        previewMode: isPreviewMode,
        generatedPreview: generatedPreviews?.[option.id],
        unavailable: unavailablePreviewIds.has(option.id),
        placeholderFixture: placeholderPreview,
      }),
    };
  }), [generatedPreviews, isPreviewMode, placeholderPreview, unavailablePreviewIds]);

  const previewsAreReady = resolvedPreviews.every(({ option, preview }) => (
    preview.kind === "placeholder" || loadedPreviews.includes(option.id)
  ));

  const previousPreviewSignature = useRef(`${isPreviewMode}:${previewSignature}`);
  useEffect(() => {
    const signature = `${isPreviewMode}:${previewSignature}`;
    if (previousPreviewSignature.current === signature) return;
    previousPreviewSignature.current = signature;
    setLoadedPreviews([]);
  }, [isPreviewMode, previewSignature]);

  useEffect(() => {
    if (phase !== "generating" || !previewsAreReady) return;
    setPhase(reducedMotionPreferred() ? "select" : "ready");
    const frame = window.requestAnimationFrame(() => setPhase("select"));
    return () => window.cancelAnimationFrame(frame);
  }, [phase, previewsAreReady]);

  async function handleContinue() {
    if (isSaving || phase === "generating") return;

    setIsSaving(true);
    setError(null);
    try {
      const bootstrap = await bootstrapCurrentOrganization();
      await apiFetch(`/strategy/${bootstrap.orgId}/video-decision`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          mode,
          source: "generated",
          tone: selectedStyle,
          uploadedVideoUrl: null,
        }),
      });
      if (!mounted.current) return;
      setPhase("approved");
      window.setTimeout(() => {
        if (mounted.current) navigateOnboarding(onboardingHref("checkout"));
      }, reducedMotionPreferred() ? 0 : 40);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your video style.");
    } finally {
      setIsSaving(false);
    }
  }

  const isPreparing = phase === "generating";
  const isWaitingForGeneratedPreview = (!isPreviewMode || placeholderPreview) && !hasGeneratedPreview;
  const statusState = isWaitingForGeneratedPreview
    ? "awaiting"
    : phase === "generating"
      ? "generating"
      : "ready";
  const contentTypeLabel = mode === "personalized" ? "personalized videos" : "AI video";

  return (
    <section className={cn("personalized-video-style-page", mobile.page)}>
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="personalized-video-style-main" aria-labelledby="personalized-video-style-title">
        <header className="personalized-video-style-header">
          <h1 id="personalized-video-style-title">
            <span className={mobile.desktopOnly}>Campaign Content<span className="signup-campaign-period">.</span></span>
            <span className={mobile.mobileOnly}>{mode === "personalized" ? "Make it sound like you." : "Set the tone."}</span>
          </h1>
          <p className={mobile.mobileOnly}>{mode === "personalized" ? "Choose a style for your personalized video." : "Choose the style of your campaign video."}</p>
        </header>

        <div
          className={cn(
            "personalized-video-style-status",
            `personalized-video-style-status-${statusState}`,
          )}
          role="status"
          aria-live="polite"
        >
          {statusState === "ready"
            ? <CheckCircle2 className="personalized-video-style-status-icon" weight="fill" aria-hidden />
            : <SparklesIcon draw={false} animationDurationScale={1.6} className="personalized-video-style-status-icon" />}
          <div className="personalized-video-style-status-copy" key={statusState}>
            <p>{statusState === "awaiting" ? "Choose your video style." : statusState === "ready" ? "Your content is ready." : `Creating your ${contentTypeLabel}...`}</p>
            <span>{statusState === "awaiting" ? "Generated previews will appear when video generation is available." : statusState === "ready" ? "Created for your business and prospects." : "Building three directions for your business and prospects."}</span>
          </div>
        </div>

        <section
          className={cn(
            "personalized-video-style-options",
            `personalized-video-style-options-${phase}`,
          )}
          aria-labelledby="personalized-video-style-options-title"
        >
          <h2 id="personalized-video-style-options-title">Choose your favorite.</h2>
          <div
            ref={railRef}
            onScroll={(event) => {
              const rail = event.currentTarget;
              const first = rail.children[0] as HTMLElement;
              if (!first) return;
              const index = Array.from(rail.children).findIndex((node) => Math.abs((node as HTMLElement).offsetLeft - first.offsetLeft - rail.scrollLeft) < first.offsetWidth / 2);
              if (index >= 0) setRailIndex(index);
            }}
            className={cn(
              "personalized-video-style-grid",
              isPreparing && "personalized-video-style-grid-preparing",
            )}
            role="radiogroup"
            aria-label={styleLabel}
          >
            {resolvedPreviews.map(({ option, preview }) => {
              const selected = option.id === selectedStyle;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-hidden={isPreparing}
                  tabIndex={isPreparing || !selected ? -1 : 0}
                  disabled={isPreparing || isSaving || phase === "approved"}
                  className={cn(
                    "personalized-video-style-card",
                    isPreparing && "personalized-video-style-card-preparing",
                    selected && !isPreparing && "personalized-video-style-card-selected",
                    selected && phase === "approved" && "personalized-video-style-card-approved",
                  )}
                  onClick={() => {
                    hasChosenStyle.current = true;
                    setSelectedStyle(option.id);
                    if (window.matchMedia("(max-width: 63rem)").matches) showStyle(STYLE_OPTIONS.findIndex((style) => style.id === option.id));
                  }}
                  onFocus={() => {
                    if (window.matchMedia("(max-width: 63rem)").matches) showStyle(STYLE_OPTIONS.findIndex((style) => style.id === option.id));
                  }}
                  onKeyDown={(event) => {
                    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                    if (!direction && event.key !== "Home" && event.key !== "End") return;
                    event.preventDefault();
                    const current = STYLE_OPTIONS.findIndex((style) => style.id === option.id);
                    const index = event.key === "Home" ? 0 : event.key === "End" ? STYLE_OPTIONS.length - 1 : (current + direction + STYLE_OPTIONS.length) % STYLE_OPTIONS.length;
                    hasChosenStyle.current = true;
                    setSelectedStyle(STYLE_OPTIONS[index].id);
                    (railRef.current?.children[index] as HTMLElement | undefined)?.focus({ preventScroll: true });
                  }}
                >
                  <span
                    className={cn(
                      "personalized-video-style-art",
                      preview.kind === "placeholder" && "personalized-video-style-art-placeholder",
                    )}
                    data-preview-kind={preview.kind}
                    aria-hidden
                  >
                    {preview.kind === "sample" ? (
                      <Image
                        src={preview.src}
                        alt=""
                        fill
                        loading="eager"
                        sizes="(min-width: 63rem) 16rem, 80vw"
                        className="object-cover"
                        onLoad={() => setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id])}
                        onError={() => {
                          setUnavailablePreviewIds((current) => new Set(current).add(option.id));
                          setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id]);
                        }}
                      />
                    ) : preview.kind === "generated-video" ? (
                      <video
                        src={preview.src}
                        poster={preview.posterUrl}
                        muted
                        playsInline
                        preload="metadata"
                        tabIndex={-1}
                        className="size-full object-cover"
                        onLoadedData={() => setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id])}
                        onError={() => {
                          setUnavailablePreviewIds((current) => new Set(current).add(option.id));
                          setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id]);
                        }}
                      />
                    ) : preview.kind === "generated-poster" ? (
                      <Image
                        src={preview.src}
                        alt=""
                        fill
                        unoptimized
                        className="size-full object-cover"
                        onLoad={() => setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id])}
                        onError={() => {
                          setUnavailablePreviewIds((current) => new Set(current).add(option.id));
                          setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id]);
                        }}
                      />
                    ) : null}
                    <span className="personalized-video-style-play"><Play className="size-6" weight="fill" /></span>
                    <span className="personalized-video-style-duration">0:10</span>
                    {preview.kind === "placeholder" ? <span className={cn(mobile.mobileOnly, mobile.previewStatus)}>Preview not generated</span> : null}
                  </span>
                  <span className="personalized-video-style-card-title">
                    {option.title}
                    {option.recommended ? <span>Recommended</span> : null}
                  </span>
                  <span className="personalized-video-style-card-description">
                    {option.qualities.map((quality) => <span key={quality}>{quality}</span>)}
                  </span>
                  <span className={cn(mobile.mobileOnly, mobile.styleDescription)}>{option.description}</span>
                  <span className={mobile.styleRadio} aria-hidden />
                </button>
              );
            })}
          </div>
          <div className={mobile.styleTabs} aria-label="Choose a video style">
            {STYLE_OPTIONS.map((option, index) => <button key={option.id} type="button" aria-pressed={selectedStyle === option.id} disabled={isSaving || phase === "approved"} onClick={() => { hasChosenStyle.current = true; setSelectedStyle(option.id); showStyle(index); }}>{option.title}</button>)}
          </div>
          <div className="video-style-rail-controls">
            <button type="button" aria-label="Previous video style" disabled={railIndex === 0} onClick={() => showStyle(railIndex - 1)}><span className={mobile.desktopOnly}>Previous</span><ArrowLeft className={mobile.mobileOnly} aria-hidden /></button>
            <span aria-live="polite">{railIndex + 1} of {STYLE_OPTIONS.length}</span>
            <button type="button" aria-label="Next video style" disabled={railIndex === STYLE_OPTIONS.length - 1} onClick={() => showStyle(railIndex + 1)}><span className={mobile.desktopOnly}>Next</span><ArrowRight className={mobile.mobileOnly} aria-hidden /></button>
          </div>
        </section>

        {error ? <p className="personalized-video-style-error" role="alert">{error}</p> : null}
      </main>

      <div className="personalized-video-style-actions">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}>
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          className="onboarding-campaign-next"
          disabled={isSaving || isPreparing || phase === "approved"}
          onClick={() => void handleContinue()}
        >
          {isPreparing ? "Creating..." : phase === "approved" ? "Approved" : isSaving ? "Saving..." : <><span className={mobile.desktopOnly}>Use this</span><span className={mobile.mobileOnly}>Use this style</span></>}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

    </section>
  );
}

export default function PersonalizedVideoStyle({ preview = false, placeholderPreview = false, initialStyle }: { preview?: boolean; placeholderPreview?: boolean; initialStyle?: VideoTone }) {
  return <VideoStyleSelection mode="personalized" styleLabel="Personalized video style" preview={preview} placeholderPreview={placeholderPreview} initialStyle={initialStyle} />;
}
