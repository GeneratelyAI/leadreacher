"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, ExternalLink, FileText, Pencil, Play, Send } from "@/components/ui/icons";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { beginOnboardingNavigation, onboardingHref, navigateOnboarding, restoreOnboardingNavigation } from "../../public/navigation";
import { storyTiming } from "../story-handoff";
import { useCampaignData } from "../../public/pill";
import styles from "../continuation/Continuation.module.css";
import messageStyles from "./MessageAndCta.module.css";
import { persistedWebsiteUrl, resolveCampaignMedia, withDefaultWebsiteCta, type CampaignMedia } from "./message-review-data";
import { usesOnboardingFixtures } from "../../public/preview-api";
import { contentWorkflowRoute } from "../../public/content-choice";

type OutreachMessage = {
  message: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  approved?: boolean;
  ctaExplicitlySaved?: boolean;
};

function previewUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function previewFixturePoster(content: string | undefined): string {
  const normalized = content?.toLowerCase() ?? "";
  if (normalized.includes("casual")) return "/landing/product-story/content-casual.webp";
  if (normalized.includes("aggressive")) return "/landing/product-story/content-aggressive.webp";
  return "/landing/product-story/content-professional.webp";
}

function VideoThumbnail({ media }: { media: CampaignMedia }) {
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const thumbnail = useRef<HTMLElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const thumbnailVideo = useRef<HTMLVideoElement>(null);
  const thumbnailCanvas = useRef<HTMLCanvasElement>(null);
  const [thumbnailReady, setThumbnailReady] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  const origin = useRef<DOMRect>(null);
  const reduced = useStableReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const activeAnimation = useRef<Animation | null>(null);

  function paintThumbnailFrame(element: HTMLVideoElement) {
    if (media.previewUrl || !element.videoWidth || !element.videoHeight || !thumbnailCanvas.current) return;
    const canvas = thumbnailCanvas.current;
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    try {
      canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
      setThumbnailReady(true);
    } catch {
      setThumbnailReady(false);
    }
  }

  function primeThumbnail(element: HTMLVideoElement) {
    paintThumbnailFrame(element);
    if (!media.previewUrl && element.duration > .05 && element.currentTime < .01) {
      try { element.currentTime = .05; } catch { /* The loaded frame remains the honest fallback. */ }
    }
  }

  useEffect(() => {
    if (!expanded || !surface.current || !origin.current) return;
    const area = thumbnail.current?.closest('[aria-label="Message review content"]')?.getBoundingClientRect();
    const actions = window.document.querySelector(".onboarding-campaign-action-row")?.getBoundingClientRect();
    if (area && dialog.current) {
      const top = Math.max(8, area.top + 8);
      const bottom = Math.min(area.bottom - 8, innerHeight - 8, innerWidth > 1008 && actions ? actions.top - 36 : innerHeight - 8);
      Object.assign(dialog.current.style, { left: `${area.left + 8}px`, top: `${top}px`, width: `${area.width - 16}px`, height: `${Math.max(1, bottom - top)}px` });
    }
    dialog.current?.showModal();
    let cancelled = false;
    const target = surface.current.getBoundingClientRect();
    const from = origin.current;
    const transform = `translate(${from.x - target.x}px, ${from.y - target.y}px) scale(${from.width / target.width}, ${from.height / target.height})`;
    const animation = surface.current.animate([
      { transform: reduced ? "none" : transform, opacity: .8, borderRadius: "10px" },
      { transform: "none", opacity: 1, borderRadius: "14px" },
    ], { ...storyTiming(false, true), duration: reduced ? 0 : storyTiming(false, true).duration });
    activeAnimation.current = animation;
    void animation.finished.then(async () => {
      if (cancelled) return;
      setReady(true);
      minimize.current?.focus({ preventScroll: true });
      if (media.kind === "video") try { await video.current?.play(); } catch { if (!cancelled) setFailed(true); }
    }).catch(() => {});
    const settle = () => {
      activeAnimation.current?.cancel();
      video.current?.pause();
      dialog.current?.close();
      closing.current = false;
      setReady(false);
      setExpanded(false);
    };
    window.addEventListener("resize", settle);
    return () => { cancelled = true; activeAnimation.current?.cancel(); window.removeEventListener("resize", settle); };
  }, [expanded, reduced, media.kind]);

  async function close() {
    if (closing.current) return;
    closing.current = true;
    activeAnimation.current?.cancel();
    video.current?.pause();
    if (surface.current && thumbnail.current) {
      const target = thumbnail.current.getBoundingClientRect();
      const from = surface.current.getBoundingClientRect();
      const animation = surface.current.animate([
        { transform: "none", opacity: 1 },
        { transform: reduced ? "none" : `translate(${target.x - from.x}px, ${target.y - from.y}px) scale(${target.width / from.width}, ${target.height / from.height})`, opacity: .7 },
      ], { ...storyTiming(false, true), duration: reduced ? 0 : storyTiming(false, true).duration, fill: "forwards" });
      activeAnimation.current = animation;
      await animation.finished.catch(() => {});
      animation.cancel();
    }
    dialog.current?.close();
    setExpanded(false);
    setReady(false);
    closing.current = false;
  }

  if (media.status !== "ready" || !media.url || (failed && !expanded)) {
    const copy = failed || media.status === "failed" ? "Campaign media could not be loaded" : media.status === "processing" ? "Campaign media is processing" : "Campaign media is not available";
    return failed && media.url
      ? <button className={messageStyles.mediaStatus} data-story-object="media" type="button" onClick={() => setFailed(false)}><span aria-hidden>{media.kind === "document" ? <FileText /> : <Play />}</span>{copy}. Retry</button>
      : <div className={messageStyles.mediaStatus} data-story-object="media" role="status"><span aria-hidden>{media.kind === "document" ? <FileText /> : <Play />}</span>{copy}</div>;
  }

  if (media.kind === "document") {
    return <a className={`${messageStyles.mediaThumbnail} ${messageStyles.interactiveMedia}`} href={media.url} target="_blank" rel="noreferrer" aria-label={`Open ${media.name ?? "campaign document"}`} data-story-object="media" data-story-asset={`media:${media.id ?? media.previewUrl ?? media.url}`}>
      <div className={messageStyles.videoSurface}>{media.previewUrl ? <Image src={media.previewUrl} alt="" fill sizes="160px" unoptimized onError={() => setFailed(true)} /> : <span className={messageStyles.documentFile}><FileText aria-hidden /><span>{media.name ?? "Campaign document"}</span></span>}<span className={messageStyles.videoPlay} aria-hidden><ExternalLink /></span></div>
    </a>;
  }

  const storyAsset = `media:${media.id ?? media.previewUrl ?? media.url}`;
  return <figure ref={thumbnail} className={`${messageStyles.mediaThumbnail} ${messageStyles.interactiveMedia}`} data-story-object="media" data-story-asset={storyAsset} data-story-ready={thumbnailReady}>
    <div className={messageStyles.videoSurface}>
      {media.previewUrl ? <Image src={media.previewUrl} alt="" fill sizes="160px" unoptimized data-story-visual="true" className={messageStyles.thumbnailPoster} onLoad={() => setThumbnailReady(true)} onError={() => setFailed(true)} /> : null}
      {!media.previewUrl ? <canvas ref={thumbnailCanvas} className={messageStyles.thumbnailFrame} data-story-visual={thumbnailReady ? "true" : undefined} aria-hidden /> : null}
      <video ref={thumbnailVideo} src={media.url} poster={media.previewUrl} preload="auto" muted playsInline aria-hidden tabIndex={-1} data-thumbnail-ready={!media.previewUrl && thumbnailReady ? "true" : "false"} onLoadedData={(event) => primeThumbnail(event.currentTarget)} onSeeked={(event) => paintThumbnailFrame(event.currentTarget)} onError={() => setFailed(true)} />
      <button ref={trigger} className={messageStyles.videoTrigger} type="button" aria-label="Play campaign video" onClick={() => { origin.current = thumbnail.current!.getBoundingClientRect(); setFailed(false); setExpanded(true); }}><span className={messageStyles.videoPlay} aria-hidden><Play weight="fill" /></span></button>
    </div>
    <dialog ref={dialog} className={messageStyles.mediaDialog} aria-label="Video preview" onClose={() => trigger.current?.focus({ preventScroll: true })} onCancel={(event) => { event.preventDefault(); void close(); }}>
    {expanded ? <div ref={surface} className={messageStyles.expandedMedia}>
      <video ref={video} src={media.url} poster={media.previewUrl} controls={ready} preload="metadata" playsInline muted onError={() => setFailed(true)} aria-label="Campaign video" />
      <button ref={minimize} className={messageStyles.videoMinimize} type="button" onClick={() => void close()}>Minimize</button>
      {failed && expanded ? <p role="alert" className={messageStyles.videoFailure}>Playback could not start. Use the video controls to retry.</p> : null}
    </div> : null}
    </dialog>
  </figure>;
}

function DirectMessagePreview({
  message,
  ctaLabel,
  ctaUrl,
  compact = false,
  siteIconUrl,
  selectedContent,
  media,
}: OutreachMessage & { compact?: boolean; siteIconUrl?: string; selectedContent?: string; media?: CampaignMedia | null }) {
  return (
    <div className={`${messageStyles.conversation} ${compact ? messageStyles.compactConversation : ""}`} role="region" aria-label={compact ? "Live message preview" : "Message preview"}>
      <div className={messageStyles.recipientRow}>
        <span className={messageStyles.companyAvatar} aria-hidden><Building2 /></span>
        <span><strong>{"{{Company}}"}</strong><small>Direct message preview</small></span>
      </div>
      <div className={messageStyles.conversationBody}>
        <p className={messageStyles.previewLabel}>Message preview</p>
        <div className={messageStyles.messageThread}>
          <div className={messageStyles.outgoingMessage}>
            <p>{message || "Write a message to see the preview."}</p>
            <span className={messageStyles.senderAvatar} aria-hidden>{siteIconUrl ? <Image src={siteIconUrl} alt="" width={32} height={32} className={messageStyles.senderSiteIcon} /> : <Send weight="fill" />}</span>
            <div className={messageStyles.attachmentGroup}>
              {selectedContent && media ? <VideoThumbnail key={media.id ?? media.url ?? `${media.kind}:${media.status}`} media={media} /> : null}
              {ctaLabel && ctaUrl ? (
                <a className={messageStyles.bookingPreview} href={ctaUrl} target="_blank" rel="noreferrer">
                  <CalendarDays aria-hidden />
                  <span><strong>{ctaLabel}</strong><small>{previewUrlLabel(ctaUrl)}</small></span>
                  <ExternalLink aria-hidden />
                </a>
              ) : <p className={messageStyles.emptyCtaPreview}>Add a call to action to include a booking link.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageAndCta() {
  const [saved, setSaved] = useState<OutreachMessage>({ message: null, ctaLabel: null, ctaUrl: null });
  const [draft, setDraft] = useState(saved);
  const [media, setMedia] = useState<CampaignMedia | null>(null);
  const [contentBackRoute, setContentBackRoute] = useState<ReturnType<typeof contentWorkflowRoute> | null>(null);
  const [editing, setEditing] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [closingEditor, setClosingEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presented, setPresented] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const orgId = useRef<string | null>(null);
  const previewPanel = useRef<HTMLDivElement>(null);
  const previewOrigin = useRef<DOMRect | null>(null);
  const editorPanel = useRef<HTMLDivElement>(null);
  const reviewCard = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  const campaign = useCampaignData();
  const campaignSite = campaign?.site;
  const selectedContent = campaign?.sections?.find((section) => section.id === "content")?.summary;
  const selectedContentAtMount = useRef(selectedContent);
  const prefersReducedMotion = useStableReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const organization = await bootstrapCurrentOrganization();
        orgId.current = organization.orgId;
        const strategy = await apiFetch<unknown>(`/strategy/${organization.orgId}`);
        if (!cancelled && strategy && typeof strategy === "object") {
          setContentBackRoute(contentWorkflowRoute(strategy as { campaignType?: string | null; icpDefinition?: unknown }));
        }
        const websiteUrl = persistedWebsiteUrl(strategy);
        const persistedMedia = resolveCampaignMedia(strategy);
        const campaignMedia = usesOnboardingFixtures() && (!persistedMedia || (persistedMedia.kind === "video" && persistedMedia.status === "processing"))
          ? { kind: "video" as const, status: "ready" as const, url: "/landing/product-story/personalized-video-outreach.mp4", previewUrl: previewFixturePoster(selectedContentAtMount.current) }
          : persistedMedia;
        if (!cancelled) setMedia(campaignMedia);
        let message = await apiFetch<OutreachMessage>(`/strategy/${organization.orgId}/outreach-message`);
        if (!message.message) message = await apiFetch<OutreachMessage>(`/strategy/${organization.orgId}/outreach-message`, { method: "POST" });
        message = withDefaultWebsiteCta(message, websiteUrl);
        if (!cancelled) {
          setSaved(message);
          setDraft(message);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to prepare your campaign message.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPresented(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    const from = previewOrigin.current;
    const panel = previewPanel.current;
    if (!from || !panel) {
      if (prefersReducedMotion) { setOpeningEditor(false); setClosingEditor(false); }
      return;
    }
    previewOrigin.current = null;
    const to = panel.getBoundingClientRect();
    const settle = () => { setOpeningEditor(false); setClosingEditor(false); };
    if (prefersReducedMotion) { settle(); return; }
    const stacked = window.matchMedia("(max-width: 63rem)").matches;
    const animation = panel.animate([
      { transform: stacked ? "none" : `translate(${from.x - to.x}px, ${from.y - to.y}px)`, opacity: .86 },
      { transform: "none", opacity: 1 },
    ], storyTiming(false, true));
    const controls = !stacked && editorPanel.current?.animate(editing ? [
      { opacity: 0, transform: "translateX(-6px)" },
      { opacity: 1, transform: "none" },
    ] : [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "translateX(-6px)" },
    ], { ...storyTiming(false, true), duration: 180, fill: "both" });
    if (controls) void controls.finished.then(() => controls.cancel()).catch(() => {});
    let cancelled = false;
    void animation.finished.then(() => { if (!cancelled) settle(); }).catch(() => {});
    const resize = () => { animation.cancel(); if (controls) controls.cancel(); settle(); };
    window.addEventListener("resize", resize);
    return () => { cancelled = true; animation.cancel(); if (controls) controls.cancel(); window.removeEventListener("resize", resize); };
  }, [editing, prefersReducedMotion]);

  useEffect(() => {
    if (editing || openingEditor || closingEditor || !restoreFocus.current) return;
    restoreFocus.current = false;
    editButton.current?.focus({ preventScroll: true });
  }, [editing, openingEditor, closingEditor]);

  useEffect(() => {
    if (!editing) return;
    const frame = window.requestAnimationFrame(() => messageInput.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  function validationMessage(value: OutreachMessage): string | null {
    if (!value.message?.trim()) return "Enter a campaign message.";
    if (Boolean(value.ctaLabel?.trim()) !== Boolean(value.ctaUrl?.trim())) return "Add both a CTA label and destination, or leave both blank.";
    if (value.ctaUrl) {
      try { new URL(value.ctaUrl); } catch { return "Enter a valid CTA destination URL."; }
    }
    return null;
  }

  function openEditor() {
    if (openingEditor || closingEditor) return;
    setError(null);
    previewOrigin.current = previewPanel.current?.getBoundingClientRect() ?? null;
    setDraft(saved);
    setOpeningEditor(!prefersReducedMotion);
    setEditing(true);
  }

  function closeEditor(value: OutreachMessage = saved) {
    if (closingEditor) return;
    // Move focus before the editor subtree becomes inert and aria-hidden.
    reviewCard.current?.focus({ preventScroll: true });
    setError(null);
    restoreFocus.current = true;
    previewOrigin.current = previewPanel.current?.getBoundingClientRect() ?? null;
    if (editorPanel.current) {
      editorPanel.current.style.setProperty("--editor-exit-width", `${editorPanel.current.offsetWidth}px`);
      editorPanel.current.style.setProperty("--editor-exit-height", `${editorPanel.current.offsetHeight}px`);
    }
    setDraft(value);
    setClosingEditor(!prefersReducedMotion);
    setEditing(false);
  }

  async function persist(approved: boolean) {
    const validation = validationMessage(draft);
    if (validation || saving) {
      setError(validation);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<OutreachMessage>(`/strategy/${orgId.current}/outreach-message`, {
        method: "PATCH",
        body: JSON.stringify({ message: draft.message, ctaLabel: draft.ctaLabel?.trim() || null, ctaUrl: draft.ctaUrl?.trim() || null, approved }),
      });
      setSaved(result);
      setDraft(result);
      if (!approved) closeEditor(result);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your campaign message.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function approveAndContinue() {
    const validation = validationMessage(draft);
    if (validation || saving) {
      setError(validation);
      return;
    }
    if (!beginOnboardingNavigation(onboardingHref("channels"))) return;
    const approved = await persist(true);
    if (approved) navigateOnboarding(onboardingHref("channels"));
    else restoreOnboardingNavigation();
  }

  return (
    <section className={styles.page} aria-labelledby="message-review-title">
      <main className={`continuation-main ${styles.main}`}>
        <header className={styles.heading}>
          <h1 id="message-review-title">Your message is ready<span className="signup-campaign-period">.</span></h1>
          <p>Review the message and call to action before choosing where to send it.</p>
        </header>

        <div className="onboarding-scene-task-scroll" role="region" aria-label="Message review content" tabIndex={0}>
        <section ref={reviewCard} tabIndex={-1} className={`${styles.card} ${styles.messageCard} ${styles.task} ${messageStyles.reviewCard}`} data-story-ready={!loading} data-presented={presented || undefined} data-editor-opening={openingEditor || undefined} data-editor-closing={closingEditor || undefined} aria-label="Message and call to action" aria-busy={loading || openingEditor || closingEditor}>
          <header className={`${styles.cardHeader} ${messageStyles.reviewHeader}`}>
            <h2>Review your message and CTA</h2>
            <span className={styles.badge}>AI generated</span>
            {!loading && !editing ? (
              <button ref={editButton} type="button" className={`${styles.textAction} ${messageStyles.editMessageButton}`} disabled={openingEditor || closingEditor} onClick={openEditor}>
                <Pencil aria-hidden />Edit message
              </button>
            ) : null}
          </header>
          {loading ? <p className={styles.loadingCopy} role="status">Generating a message for your campaign...</p> : (
            <div className={`${styles.messageEditor} ${messageStyles.composerWorkspace} ${editing ? messageStyles.editorWorkspace : ""}`} data-editing={editing} data-testid="message-editor-workspace">
              <div ref={editorPanel} className={messageStyles.editorPanel} inert={!editing} aria-hidden={!editing}>
                <div className={messageStyles.editorIntro}><strong>Edit your direct message</strong><span>Changes appear in the preview as you type.</span></div>
                <label className={messageStyles.messageInputLabel}>
                  <span className={messageStyles.fieldLabelRow}><span>Campaign message</span><span className={messageStyles.messageCounter}>{draft.message?.length ?? 0} / 1000</span></span>
                  <textarea ref={messageInput} value={draft.message ?? ""} maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} />
                </label>
              <div className={`${styles.ctaFields} ${messageStyles.ctaFieldGroup}`}>
                <label>CTA label<input value={draft.ctaLabel ?? ""} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, ctaLabel: event.target.value }))} placeholder="Book a quick call" /></label>
                <label>CTA destination<input type="url" value={draft.ctaUrl ?? ""} onChange={(event) => setDraft((current) => ({ ...current, ctaUrl: event.target.value }))} placeholder="https://example.com/demo" /></label>
              </div>
              <div className={`${styles.editActions} ${messageStyles.editorActions}`}>
                <Button type="button" variant="secondary" disabled={saving || closingEditor} onClick={() => closeEditor()}>Cancel</Button>
                <Button type="button" disabled={saving} onClick={() => void persist(false)}>{saving ? "Saving..." : "Save changes"}</Button>
              </div>
              </div>
              <div ref={previewPanel} className={`${messageStyles.composerPreview} ${editing ? messageStyles.editorPreview : ""}`}>
                {editing ? <span className={messageStyles.editorPreviewLabel}>Live preview</span> : null}
                <DirectMessagePreview {...(editing ? draft : saved)} compact={editing} siteIconUrl={campaignSite?.iconUrl} selectedContent={selectedContent} media={media} />
                {!editing && (!saved.ctaLabel || !saved.ctaUrl) ? <p className={styles.ctaEmpty}>No call to action added.</p> : null}
              </div>
            </div>
          )}
        </section>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </main>
      <div className="onboarding-campaign-action-row">
        <Button type="button" variant="secondary" className="campaign-content-back" disabled={loading || !contentBackRoute} onClick={() => contentBackRoute && navigateOnboarding(onboardingHref(contentBackRoute))}><ArrowLeft aria-hidden />Back</Button>
        <Button type="button" className="onboarding-campaign-next" disabled={loading || saving || editing || openingEditor || closingEditor || !saved.message} onClick={() => void approveAndContinue()}>
          {saving ? "Approving..." : "Approve and continue"}<ArrowRight aria-hidden />
        </Button>
      </div>
    </section>
  );
}
