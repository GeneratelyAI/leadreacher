import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { WebsiteScrapeStatus } from "../public/website-status";
import { getDiscoveryOrgScope } from "../public/discovery-cache";
import { EMPTY_PROFILE, PROFILE_ROWS, type ProspectProfile } from "../state/prospect-profile";

export function useProspectReview(status: WebsiteScrapeStatus, reduceMotion: boolean | null, setAdditionalContext: (value: string) => void) {
  const [review, setReview] = useState<{ sourceKey: string | null; profile: ProspectProfile }>({ sourceKey: null, profile: EMPTY_PROFILE });
  const [removingProspects, setRemovingProspects] = useState<Set<string>>(() => new Set());
  const [highlightedRow, setHighlightedRow] = useState<keyof ProspectProfile | null>(null);
  const [removalAnnouncement, setRemovalAnnouncement] = useState("");
  let orgScope: string | null = null;
  try { orgScope = getDiscoveryOrgScope(); } catch { /* Storage can be disabled. */ }
  const sourceKey = status.url ? `lr_prospect_review:${orgScope ?? "preview"}:${status.url}` : null;
  const profile = review.sourceKey === sourceKey ? review.profile : EMPTY_PROFILE;
  const setProfile = useCallback((next: SetStateAction<ProspectProfile>) => {
    setReview((current) => current.sourceKey === sourceKey
      ? { ...current, profile: typeof next === "function" ? next(current.profile) : next }
      : current);
  }, [sourceKey]);
  const rowHighlightTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!sourceKey || review.sourceKey !== sourceKey) return;
    try {
      window.sessionStorage.setItem(sourceKey, JSON.stringify({ profile: review.profile }));
    } catch { /* The saved campaign remains authoritative; drafts are optional. */ }
  }, [review, sourceKey]);

  useEffect(() => {
    if (status.status !== "completed" || !sourceKey || review.sourceKey === sourceKey) return;
    let restored = status.prospectProfile ?? EMPTY_PROFILE;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(sourceKey) ?? "null");
      const savedProfile = saved?.profile ?? saved;
      if (savedProfile && PROFILE_ROWS.every(({ key }) => Array.isArray(savedProfile[key]) && savedProfile[key].every((value: unknown) => typeof value === "string"))) {
        restored = savedProfile;
      }
    } catch { /* Saved review state is optional when storage is unavailable. */ }
    setReview({ sourceKey, profile: restored });
    setAdditionalContext("");
  }, [status, sourceKey, review.sourceKey, setAdditionalContext]);

  useEffect(() => () => {
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
  }, []);

  const prospectId = (key: keyof ProspectProfile, value: string) => `${key}:${value}`;

  const queueProspectRemoval = (key: keyof ProspectProfile, value: string) => {
    const id = prospectId(key, value);
    setRemovingProspects((current) => current.has(id) ? current : new Set(current).add(id));
  };

  const finishProspectRemoval = (key: keyof ProspectProfile, value: string) => {
    const id = prospectId(key, value);
    setRemovingProspects((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setProfile((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));
    setRemovalAnnouncement(`${value} removed from ${PROFILE_ROWS.find((row) => row.key === key)?.label ?? "prospects"}.`);
    if (rowHighlightTimeoutRef.current !== null) window.clearTimeout(rowHighlightTimeoutRef.current);
    rowHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedRow(key);
      rowHighlightTimeoutRef.current = window.setTimeout(() => setHighlightedRow(null), reduceMotion ? 0 : 460);
    }, reduceMotion ? 0 : 210);
  };

  const resetReview = () => setReview({ sourceKey: null, profile: EMPTY_PROFILE });

  return { profile, setProfile, removingProspects, highlightedRow, removalAnnouncement, setRemovalAnnouncement, resetReview, prospectId, queueProspectRemoval, finishProspectRemoval };
}
