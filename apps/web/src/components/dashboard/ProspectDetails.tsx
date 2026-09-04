"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, ExternalLink, Loader2 } from "@/components/ui/icons";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatSocialMediaNames } from "@/components/dashboard/ChannelIdentity";
import { apiFetch } from "@/lib/api";

type ProspectDetail = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  source: string;
  reviewStatus: "pending" | "approved" | "excluded";
  messages: Array<{ id: string; direction: string; content: { message: string } }>;
  campaigns: Array<{
    id: string;
    status: string;
    campaign: { id: string; name: string; status: string };
  }>;
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProspectAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <Image src={url} width={48} height={48} alt="" unoptimized className="size-12 rounded-full object-cover" />;
  return <span className="inline-flex size-12 items-center justify-center rounded-full bg-onboarding-purple-100 text-sm font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">{initials(name)}</span>;
}

export function ProspectDetails({ prospectId, presentation }: { prospectId: string; presentation: "page" | "drawer" }) {
  const router = useRouter();
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ lead: ProspectDetail }>(`/dashboard/prospects/${prospectId}`)
      .then((result) => {
        if (!cancelled) {
          setProspect({
            ...result.lead,
            campaigns: result.lead.campaigns.map((membership) => ({
              ...membership,
              campaign: {
                ...membership.campaign,
                name: formatSocialMediaNames(membership.campaign.name),
              },
            })),
          });
          setError(null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load prospect details.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [prospectId]);

  async function updateReview(reviewStatus: "approved" | "excluded") {
    if (!prospect || isUpdating) return;
    setIsUpdating(true);
    try {
      await apiFetch(`/dashboard/prospects/${prospect.id}/review`, { method: "PATCH", body: JSON.stringify({ reviewStatus }) });
      setProspect({ ...prospect, reviewStatus });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update prospect review.");
    } finally {
      setIsUpdating(false);
    }
  }

  const close = () => {
    if (presentation === "drawer") router.back();
    else router.push("/dashboard/prospects");
  };

  const body = isLoading ? <div className="flex min-h-56 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400"><Loader2 className="mr-2 size-4 animate-spin" />Loading prospect details</div> : error || !prospect ? <div className="p-6" role="alert"><p className="text-sm text-onboarding-error-900 dark:text-onboarding-error-50">{error ?? "Prospect details are unavailable."}</p><Button className="mt-4" variant="secondary" onClick={close}>Back to prospects</Button></div> : <div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><ProspectAvatar name={`${prospect.firstName} ${prospect.lastName}`} url={prospect.avatarUrl} /><div><h1 className="text-xl font-semibold">{prospect.firstName} {prospect.lastName}</h1><p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{prospect.title || "Title unavailable"} at {prospect.company || "Company unavailable"}</p></div></div>{presentation === "page" ? <Button variant="ghost" size="icon" onClick={close} aria-label="Close prospect details">×</Button> : null}</div><div className="mt-6 flex flex-wrap gap-2">{prospect.reviewStatus !== "approved" ? <Button variant="brand" disabled={isUpdating} onClick={() => void updateReview("approved")}><Check /> Approve</Button> : null}{prospect.reviewStatus !== "excluded" ? <Button variant="outline" disabled={isUpdating} onClick={() => void updateReview("excluded")}>Exclude</Button> : null}{prospect.linkedinUrl ? <Button variant="secondary" asChild><a href={prospect.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <ExternalLink /></a></Button> : null}</div><dl className="mt-7 grid grid-cols-1 gap-x-5 gap-y-5 text-sm sm:grid-cols-2"><div><dt className="text-onboarding-neutral-500">Location</dt><dd className="mt-1 font-medium">{prospect.location || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Source</dt><dd className="mt-1 font-medium">{titleCase(prospect.source)}</dd></div><div><dt className="text-onboarding-neutral-500">Email</dt><dd className="mt-1 break-all font-medium">{prospect.email || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Phone</dt><dd className="mt-1 font-medium">{prospect.phone || "Unavailable"}</dd></div></dl><section className="mt-8"><h2 className="font-semibold">Campaign membership</h2><div className="mt-3 space-y-2">{prospect.campaigns.length ? prospect.campaigns.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-lg border border-onboarding-neutral-150 px-3 py-2 text-sm dark:border-onboarding-neutral-750"><span>{membership.campaign.name}</span><span className="text-onboarding-neutral-500">{titleCase(membership.status)}</span></div>) : <p className="text-sm text-onboarding-neutral-500">Not enrolled in a campaign.</p>}</div></section><section className="mt-8"><h2 className="font-semibold">Recent activity</h2><div className="mt-3 space-y-3">{prospect.messages.length ? prospect.messages.map((message) => <div key={message.id} className="text-sm"><p className="font-medium">{message.direction === "inbound" ? "Inbound reply" : "Outbound message"}</p><p className="mt-1 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{message.content.message}</p></div>) : <p className="text-sm text-onboarding-neutral-500">No recorded messages yet.</p>}</div></section></div>;

  if (presentation === "page") return <div className="mx-auto w-full max-w-[64rem] px-[var(--dashboard-page-px,1rem)] py-[var(--dashboard-page-py,1.25rem)]"><section className="rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">{body}</section></div>;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Prospect details</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}
