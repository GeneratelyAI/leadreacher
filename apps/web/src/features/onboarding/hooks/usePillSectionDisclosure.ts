"use client";

import { useEffect, useRef, useState } from "react";
import type { PillSection } from "../public/campaign-summary";

type DetailPresentation = {
  height: number;
  fieldCount?: number;
};

export function usePillSectionDisclosure(sections: PillSection[], mobile: boolean, prefersReducedMotion: boolean) {
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [detailPresentations, setDetailPresentations] = useState<Record<string, DetailPresentation>>({});
  const sectionListRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pointerLeaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pointerLeaveTimeoutRef.current !== null) window.clearTimeout(pointerLeaveTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (expandedSectionId && !sections.some((section) => section.id === expandedSectionId)) {
      setExpandedSectionId(null);
    }
  }, [expandedSectionId, sections]);

  function clearPointerLeaveTimeout() {
    if (pointerLeaveTimeoutRef.current !== null) {
      window.clearTimeout(pointerLeaveTimeoutRef.current);
      pointerLeaveTimeoutRef.current = null;
    }
  }

  function measureDetailPresentation(sectionId: string): DetailPresentation {
    const list = sectionListRef.current;
    const detail = detailMeasureRefs.current[sectionId];
    if (!list || !detail) return { height: 0 };

    const compactSectionHeight = Object.entries(sectionRefs.current).reduce((total, [id, section]) => {
      if (!section) return total;
      const visibleDetail = detailContainerRefs.current[id];
      const detailHeight = visibleDetail?.offsetHeight ?? 0;
      const detailMargin = detailHeight > 0 && visibleDetail
        ? Number.parseFloat(window.getComputedStyle(visibleDetail).marginTop) || 0
        : 0;
      return total + section.offsetHeight - detailHeight - detailMargin;
    }, 0);
    const availableHeight = Math.max(0, list.clientHeight - compactSectionHeight);
    const naturalHeight = detail.scrollHeight;
    if (mobile) return { height: naturalHeight };

    if (naturalHeight <= availableHeight) return { height: naturalHeight };

    const fieldElements = Array.from(detail.querySelectorAll<HTMLElement>(".campaign-pill-section-field"));
    const fieldCount = fieldElements.reduce((count, field, index) => {
      const height = field.offsetTop + field.offsetHeight;
      return height <= availableHeight - 44 ? index + 1 : count;
    }, 0);
    if (fieldCount > 0) {
      const finalField = fieldElements[fieldCount - 1];
      return { height: finalField.offsetTop + finalField.offsetHeight + 44, fieldCount };
    }

    return { height: Math.min(44, availableHeight), fieldCount: 0 };
  }

  function expandSection(sectionId: string) {
    clearPointerLeaveTimeout();
    const presentation = measureDetailPresentation(sectionId);
    setDetailPresentations((current) => ({ ...current, [sectionId]: presentation }));
    setExpandedSectionId(presentation.height > 0 ? sectionId : null);
  }

  function collapseSection(sectionId: string, withPointerGrace = false) {
    clearPointerLeaveTimeout();
    const close = () => setExpandedSectionId((current) => current === sectionId ? null : current);
    if (prefersReducedMotion || !withPointerGrace) {
      close();
      return;
    }
    pointerLeaveTimeoutRef.current = window.setTimeout(close, 100);
  }

  return { expandedSectionId, detailPresentations, sectionListRef, sectionRefs, detailMeasureRefs, detailContainerRefs, expandSection, collapseSection };
}
