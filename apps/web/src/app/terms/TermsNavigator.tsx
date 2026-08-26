"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Search } from "@/components/ui/icons";

type SectionLink = {
  number: number;
  title: string;
  id: string;
};

type TermsNavigatorProps = {
  sections: readonly SectionLink[];
  contentId?: string;
  documentLabel?: string;
};

function PrintIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></svg>;
}

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

export default function TermsNavigator({
  sections,
  contentId = "terms-content",
  documentLabel = "terms",
}: TermsNavigatorProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const mobileDetailsRef = useRef<HTMLDetailsElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const sidebarAnimationRef = useRef(0);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return sections;
    return sections.filter((section) =>
      `${section.number} ${section.title}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query, sections]);

  useEffect(() => {
    let animationFrame = 0;
    let sectionOffsets: Array<{ id: string; top: number }> = [];

    const calculateOffsets = () => {
      sectionOffsets = sections.flatMap((section) => {
        const element = document.getElementById(section.id);
        return element ? [{ id: section.id, top: element.getBoundingClientRect().top + window.scrollY }] : [];
      });
    };

    const updateProgress = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0);

        const marker = window.scrollY + Math.min(180, window.innerHeight * 0.24);
        let currentId = sections[0]?.id ?? "";
        for (const section of sectionOffsets) {
          if (section.top > marker) break;
          currentId = section.id;
        }
        setActiveId(currentId);
      });
    };

    const handleResize = () => {
      calculateOffsets();
      updateProgress();
    };

    calculateOffsets();
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", handleResize);
    const article = document.getElementById(contentId);
    const resizeObserver = article ? new ResizeObserver(handleResize) : null;
    if (article) resizeObserver?.observe(article);
    void document.fonts?.ready.then(handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", handleResize);
    };
  }, [contentId, sections]);

  useEffect(() => {
    const navigation = desktopNavRef.current;
    const activeLink = navigation?.querySelector<HTMLElement>(`[data-section-id="${activeId}"]`);
    if (!navigation || !activeLink) return;

    const navigationRect = navigation.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const linkTop = linkRect.top - navigationRect.top + navigation.scrollTop;
    const maxScrollTop = Math.max(navigation.scrollHeight - navigation.clientHeight, 0);
    const nextScrollTop = Math.min(
      Math.max(linkTop - navigation.clientHeight / 2 + linkRect.height / 2, 0),
      maxScrollTop,
    );

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(sidebarAnimationRef.current);

    if (reduceMotion) {
      navigation.scrollTop = nextScrollTop;
      return;
    }

    const startScrollTop = navigation.scrollTop;
    const distance = nextScrollTop - startScrollTop;
    if (Math.abs(distance) < 1) return;

    const duration = Math.min(320, Math.max(180, Math.abs(distance) * 0.18));
    const startTime = performance.now();
    const animate = (time: number) => {
      const elapsed = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      navigation.scrollTop = startScrollTop + distance * eased;
      if (elapsed < 1) sidebarAnimationRef.current = requestAnimationFrame(animate);
    };

    sidebarAnimationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(sidebarAnimationRef.current);
  }, [activeId, filteredSections]);

  const navigate = (id: string, closeMobile = false) => {
    scrollToSection(id);
    setActiveId(id);
    if (closeMobile && mobileDetailsRef.current) mobileDetailsRef.current.open = false;
  };

  const sectionList = (closeMobile = false) => (
    <ol className="space-y-0.5">
      {filteredSections.map((section) => {
        const isActive = section.id === activeId;
        return (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => navigate(section.id, closeMobile)}
              data-section-id={section.id}
              aria-current={isActive ? "location" : undefined}
              className={`group flex min-h-10 w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[0.8125rem] leading-5 transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6346f6] ${
                isActive
                  ? "bg-[#eeeaff] font-semibold text-[#4d34ca]"
                  : "text-[#6b6d7d] hover:translate-x-0.5 hover:bg-[#f7f5ff] hover:text-[#4d34ca] motion-reduce:transform-none"
              }`}
            >
              <span className={`w-6 shrink-0 font-mono text-[0.6875rem] ${isActive ? "text-[#6346e7]" : "text-[#a09bb6] group-hover:text-[#755de8]"}`}>
                {String(section.number).padStart(2, "0")}
              </span>
              <span>{section.title}</span>
            </button>
          </li>
        );
      })}
      {filteredSections.length === 0 ? (
        <li className="px-3 py-6 text-center text-sm leading-6 text-[#7a7c8d]">
          No matching section found.
        </li>
      ) : null}
    </ol>
  );

  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-0 z-[70] h-0.5 bg-transparent print:hidden">
        <div
          className="h-full origin-left bg-[linear-gradient(90deg,#5437e8,#7662ff,#4da3ff)] shadow-[0_0_10px_rgba(99,70,246,0.5)] will-change-transform"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <details ref={mobileDetailsRef} className="group mb-8 rounded-2xl border border-[#deddea] bg-white p-4 shadow-sm print:hidden lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#22243a] [&::-webkit-details-marker]:hidden">
          <span>
            Quick navigation
            <span className="ml-2 font-normal text-[#858697]">{sections.find((section) => section.id === activeId)?.number ?? 1} of {sections.length}</span>
          </span>
          <span className="text-lg text-[#684cf0] transition-transform group-open:rotate-45">+</span>
        </summary>
        <nav aria-label={`${documentLabel} sections`} className="mt-3 border-t border-[#eceaf3] pt-3">
          <label className="relative mb-3 block">
            <span className="sr-only">Search {documentLabel} sections</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9692aa]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a section"
              className="min-h-11 w-full rounded-xl border border-[#ddd9eb] bg-[#faf9fd] pl-10 pr-3 text-sm text-[#24263a] outline-none transition-[border-color,box-shadow] placeholder:text-[#9899a8] focus:border-[#8d7aed] focus:ring-3 focus:ring-[#6a4df0]/10"
            />
          </label>
          <div className="max-h-[55dvh] overflow-y-auto overscroll-contain [scrollbar-color:#c7c0e8_transparent] [scrollbar-width:thin]">
            {sectionList(true)}
          </div>
        </nav>
      </details>

      <aside className="hidden print:hidden lg:block">
        <div className="sticky top-6 rounded-2xl border border-[#deddea] bg-white p-3 shadow-[0_16px_38px_rgba(23,20,54,0.06)]">
          <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5c3df2]">On this page</p>
              <p className="mt-1 text-xs text-[#9192a1]">Section {sections.find((section) => section.id === activeId)?.number ?? 1} of {sections.length}</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex size-10 items-center justify-center rounded-xl border border-[#e2dfec] text-[#696b7b] transition-[border-color,background-color,color] hover:border-[#c8c0f1] hover:bg-[#f5f2ff] hover:text-[#5238d8] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6346f6]"
              aria-label={`Print ${documentLabel}`}
              title={`Print ${documentLabel}`}
            >
              <PrintIcon className="size-4" />
            </button>
          </div>
          <label className="relative mb-3 block">
            <span className="sr-only">Search {documentLabel} sections</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9692aa]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a section"
              className="min-h-10 w-full rounded-xl border border-[#e2dfec] bg-[#faf9fd] pl-9 pr-3 text-sm text-[#24263a] outline-none transition-[border-color,box-shadow] placeholder:text-[#9899a8] focus:border-[#8d7aed] focus:ring-3 focus:ring-[#6a4df0]/10"
            />
          </label>
          <nav ref={desktopNavRef} aria-label={`${documentLabel} sections`} className="max-h-[calc(100dvh-13.5rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-color:#c7c0e8_transparent] [scrollbar-width:thin]">
            {sectionList()}
          </nav>
        </div>
      </aside>

      {progress > 0.06 ? (
        <button
          type="button"
          onClick={() => scrollToSection("top")}
          className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full border border-white/70 bg-[#19182a]/92 text-white shadow-[0_14px_34px_rgba(18,17,38,0.24)] backdrop-blur-md transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#5437e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b50f2] motion-reduce:transform-none print:hidden sm:bottom-7 sm:right-7"
          aria-label="Back to top"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      ) : null}
    </>
  );
}
