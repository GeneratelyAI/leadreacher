"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, ExternalLink, FileText, FileVideo, Pencil, Play, Send } from "@/components/ui/icons";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { onboardingHref, navigateOnboarding } from "../../public/navigation";
import { useCampaignData } from "../../public/pill";
import styles from "../continuation/Continuation.module.css";
import messageStyles from "./MessageAndCta.module.css";

type OutreachMessage = {
  message: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  approved?: boolean;
};

function previewUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function DirectMessagePreview({
  message,
  ctaLabel,
  ctaUrl,
  compact = false,
  siteIconUrl,
  selectedContent,
}: OutreachMessage & { compact?: boolean; siteIconUrl?: string; selectedContent?: string }) {
  const isDocument = selectedContent?.toLowerCase().includes("document");
  return (
    <div className={`${messageStyles.conversation} ${compact ? messageStyles.compactConversation : ""}`} role="region" aria-label={compact ? "Live message preview" : "Message preview"}>
      <div className={messageStyles.recipientRow}>
        <span className={messageStyles.companyAvatar} aria-hidden>
          {siteIconUrl ? <Image src={siteIconUrl} alt="" width={32} height={32} className={messageStyles.companySiteIcon} /> : <Building2 />}
        </span>
        <span><strong>{"{{Company}}"}</strong><small>Direct message preview</small></span>
      </div>
      <div className={messageStyles.conversationBody}>
        <p className={messageStyles.previewLabel}>Message preview</p>
        <div className={messageStyles.messageThread}>
          <div className={messageStyles.outgoingMessage}>
            <p>{message || "Write a message to see the preview."}</p>
            <span className={messageStyles.senderAvatar} aria-hidden>{siteIconUrl ? <Image src={siteIconUrl} alt="" width={32} height={32} className={messageStyles.senderSiteIcon} /> : <Send weight="fill" />}</span>
          </div>
          {selectedContent ? (
            <div className={messageStyles.contentAttachment} data-content-kind={isDocument ? "document" : "video"}>
              <span className={messageStyles.contentAttachmentIcon} aria-hidden>{isDocument ? <FileText /> : <FileVideo />}</span>
              <span className={messageStyles.contentAttachmentCopy}>
                <strong>{isDocument ? "Campaign document" : "Campaign video"}</strong>
                <small>{selectedContent}</small>
              </span>
              {!isDocument ? <span className={messageStyles.contentAttachmentPlay} aria-hidden><Play weight="fill" /></span> : null}
            </div>
          ) : null}
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
  );
}

export default function MessageAndCta() {
  const [saved, setSaved] = useState<OutreachMessage>({ message: null, ctaLabel: null, ctaUrl: null });
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presented, setPresented] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const orgId = useRef<string | null>(null);
  const campaign = useCampaignData();
  const campaignSite = campaign?.site;
  const selectedContent = campaign?.sections?.find((section) => section.id === "content")?.summary;
  const prefersReducedMotion = useStableReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const organization = await bootstrapCurrentOrganization();
        orgId.current = organization.orgId;
        let message = await apiFetch<OutreachMessage>(`/strategy/${organization.orgId}/outreach-message`);
        if (!message.message) message = await apiFetch<OutreachMessage>(`/strategy/${organization.orgId}/outreach-message`, { method: "POST" });
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

  useEffect(() => {
    if (!openingEditor) return;
    if (prefersReducedMotion) {
      setOpeningEditor(false);
      setEditing(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setOpeningEditor(false);
      setEditing(true);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [openingEditor, prefersReducedMotion]);

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
    if (openingEditor) return;
    setDraft(saved);
    if (prefersReducedMotion) {
      setEditing(true);
      return;
    }
    setOpeningEditor(true);
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
      setEditing(false);
      requestAnimationFrame(() => editButton.current?.focus({ preventScroll: true }));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your campaign message.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="message-review-title">
      <main className={`continuation-main ${styles.main}`}>
        <header className={styles.heading}>
          <h1 id="message-review-title">Your message is ready<span className="signup-campaign-period">.</span></h1>
          <p>Review the message and call to action before choosing where to send it.</p>
        </header>

        <div className="onboarding-scene-task-scroll" role="region" aria-label="Message review content" tabIndex={0}>
        <section className={`${styles.card} ${styles.messageCard} ${styles.task} ${messageStyles.reviewCard}`} data-presented={presented || undefined} data-editor-opening={openingEditor || undefined} aria-label="Message and call to action" aria-busy={loading || openingEditor}>
          <header className={`${styles.cardHeader} ${messageStyles.reviewHeader}`}>
            <h2>Review your message and CTA</h2>
            <span className={styles.badge}>AI generated</span>
            {!loading && !editing ? (
              <button ref={editButton} type="button" className={`${styles.textAction} ${messageStyles.editMessageButton}`} disabled={openingEditor} onClick={openEditor}>
                <Pencil aria-hidden />Edit message
              </button>
            ) : null}
          </header>
          {loading ? <p className={styles.loadingCopy} role="status">Generating a message for your campaign...</p> : editing ? (
            <div className={`${styles.messageEditor} ${messageStyles.editorWorkspace}`} data-testid="message-editor-workspace">
              <div className={messageStyles.editorPanel}>
                <div className={messageStyles.editorIntro}><strong>Edit your direct message</strong><span>Changes appear in the preview as you type.</span></div>
                <label className={messageStyles.messageInputLabel}>
                  <span className={messageStyles.fieldLabelRow}><span>Campaign message</span><span className={messageStyles.messageCounter}>{draft.message?.length ?? 0} / 1000</span></span>
                  <textarea ref={messageInput} value={draft.message ?? ""} maxLength={1000} onChange={(event) => setDraft({ ...draft, message: event.target.value })} />
                </label>
              <div className={`${styles.ctaFields} ${messageStyles.ctaFieldGroup}`}>
                <label>CTA label<input value={draft.ctaLabel ?? ""} maxLength={80} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} placeholder="Book a quick call" /></label>
                <label>CTA destination<input type="url" value={draft.ctaUrl ?? ""} onChange={(event) => setDraft({ ...draft, ctaUrl: event.target.value })} placeholder="https://example.com/demo" /></label>
              </div>
              <div className={`${styles.editActions} ${messageStyles.editorActions}`}>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => { setDraft(saved); setEditing(false); requestAnimationFrame(() => editButton.current?.focus({ preventScroll: true })); }}>Cancel</Button>
                <Button type="button" disabled={saving} onClick={() => void persist(false)}>{saving ? "Saving..." : "Save changes"}</Button>
              </div>
              </div>
              <div className={messageStyles.editorPreview}>
                <span className={messageStyles.editorPreviewLabel}>Live preview</span>
                <DirectMessagePreview {...draft} compact siteIconUrl={campaignSite?.iconUrl} selectedContent={selectedContent} />
              </div>
            </div>
          ) : (
            <>
              <DirectMessagePreview {...saved} siteIconUrl={campaignSite?.iconUrl} selectedContent={selectedContent} />
              {!saved.ctaLabel || !saved.ctaUrl ? <p className={styles.ctaEmpty}>No call to action added.</p> : null}
              <footer className={`${styles.messageFooter} ${messageStyles.reviewFooter}`}>
                <p className={styles.personalization}>Personalization: {"{{FirstName}} · {{Company}}"}</p>
                <p className={styles.approvalNote}>Nothing is sent until you approve.</p>
              </footer>
            </>
          )}
        </section>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </main>
      <div className="onboarding-campaign-action-row">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}><ArrowLeft aria-hidden />Back</Button>
        <Button type="button" className="onboarding-campaign-next" disabled={loading || saving || editing || !saved.message} onClick={() => void persist(true).then((ok) => { if (ok) navigateOnboarding(onboardingHref("channels")); })}>
          {saving ? "Approving..." : "Approve and continue"}<ArrowRight aria-hidden />
        </Button>
      </div>
    </section>
  );
}
