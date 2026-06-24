"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const MOBILE_SHEET_ANIMATION_MS = 300;

export function OnboardingMobileSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  ariaLabel,
  closeAriaLabel,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  ariaLabel: string;
  closeAriaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let enterTimer: number | undefined;

    if (isOpen) {
      enterTimer = window.setTimeout(() => {
        setIsMounted(true);
        setIsExiting(false);
      }, 0);

      return () => window.clearTimeout(enterTimer);
    }

    if (!isMounted) {
      return;
    }

    const exitStartTimer = window.setTimeout(() => setIsExiting(true), 0);
    const exitEndTimer = window.setTimeout(() => {
      setIsMounted(false);
      setIsExiting(false);
    }, MOBILE_SHEET_ANIMATION_MS);

    return () => {
      window.clearTimeout(exitStartTimer);
      window.clearTimeout(exitEndTimer);
    };
  }, [isOpen, isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        className={`discovery-mobile-sheet-backdrop absolute inset-0 bg-black/40 ${
          isExiting ? "discovery-mobile-sheet-backdrop--exiting" : ""
        }`}
        aria-label={closeAriaLabel}
        onClick={onClose}
      />
      <div
        className={`discovery-mobile-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] ${
          isExiting ? "discovery-mobile-sheet--exiting" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <span className="discovery-mobile-sheet__handle h-1 w-10 rounded-full bg-neutral-200" aria-hidden />
        </div>

        <div className="discovery-mobile-sheet__header flex shrink-0 items-start gap-2.5 border-b border-neutral-100 px-5 pb-4">
          {icon}
          <div className="min-w-0 flex-1">
            <p className="discovery-campaign-title text-sm font-bold leading-5 tracking-tight text-neutral-900">
              {title}
            </p>
            {subtitle ? (
              <p className="discovery-campaign-subtitle text-xs leading-4 text-neutral-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="discovery-mobile-sheet__close inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer ? (
          <div className="discovery-mobile-sheet__footer shrink-0 border-t border-neutral-100 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
