"use client";

import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";
import { BRAND_COLORS } from "@/lib/constants/brand";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ThemeToggleButton() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="discovery-top-chrome__toggle inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200/80 bg-white/85 text-neutral-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}

export function AccountMenu({
  userInitials,
  menuPlacement,
}: {
  userInitials: string;
  menuPlacement: "push" | "overlay";
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const userButton = (
    <button
      type="button"
      onClick={() => setMenuOpen((open) => !open)}
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      aria-label="Account menu"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-2 transition-colors",
        menuOpen
          ? "ring-[#5326b7]/35 dark:ring-[#c4b5f0]/35"
          : "ring-transparent",
      )}
      style={{ backgroundColor: BRAND_COLORS.purple }}
    >
      {userInitials}
    </button>
  );

  const menuPanel = (
    <div
      role="menu"
      aria-label="Account"
      className={cn(
        "discovery-mobile-campaign-pill discovery-account-menu rounded-full px-3 py-2",
        menuOpen ? "discovery-account-menu--open" : "discovery-account-menu--closed",
      )}
    >
      <button
        type="button"
        role="menuitem"
        disabled={loggingOut}
        onClick={() => void handleLogout()}
        className="discovery-account-menu__item discovery-campaign-title flex w-full items-center gap-2.5 text-sm font-semibold text-neutral-900"
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        <span>{loggingOut ? "Logging out..." : "Log out"}</span>
      </button>
    </div>
  );

  if (menuPlacement === "overlay") {
    return (
      <div ref={menuRef} className="relative shrink-0">
        {userButton}
        <div
          className={cn(
            "absolute top-[calc(100%+0.5rem)] right-0 z-50 w-[min(220px,70vw)]",
            !menuOpen && "pointer-events-none",
          )}
        >
          {menuPanel}
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="flex w-full flex-col items-end gap-3">
      <div className="discovery-top-chrome flex shrink-0 items-center gap-2 self-end">
        <ThemeToggleButton />
        {userButton}
      </div>
      <div
        className={cn(
          "grid w-[min(220px,70vw)] transition-[grid-template-rows] duration-200 ease-out",
          menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">{menuPanel}</div>
      </div>
    </div>
  );
}
