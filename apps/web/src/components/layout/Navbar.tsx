"use client";

import Link from "next/link";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { buttonVariants } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { useNavbarTheme } from "@/hooks/useNavbarTheme";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#resources", label: "Resources", hasDropdown: true },
] as const;

const themeTransition = "transition-[color,opacity,transform] duration-500 ease-in-out";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const { isDark } = useNavbarTheme();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-in-out",
        isDark ? "px-4 pt-3 sm:px-6 sm:pt-4" : "p-0",
      )}
    >
      <nav className="relative flex h-16 w-full items-center justify-between pl-4 pr-5 sm:pl-5 sm:pr-8">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full bg-brand-bg/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/15 backdrop-blur-xl backdrop-brightness-75 transition-opacity duration-500 ease-in-out",
            isDark ? "opacity-100" : "opacity-0",
          )}
        />

        <Link href="/" className="relative z-10 flex shrink-0 items-center">
          <Logo
            size="xs"
            variant={isDark ? "white" : "colored"}
            align="left"
            crossfade
            className="h-6 max-w-none sm:h-6.5"
          />
        </Link>

        <ul className="absolute left-1/2 z-10 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium",
                  themeTransition,
                  isDark
                    ? "text-white/95 hover:text-white"
                    : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                {link.label}
                {"hasDropdown" in link && link.hasDropdown ? (
                  <ChevronDownIcon
                    className={cn(
                      "size-3",
                      themeTransition,
                      isDark ? "text-white/90" : "text-neutral-500",
                    )}
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <div className="relative z-10 flex shrink-0 items-center gap-5 sm:gap-6">
          <Link
            href="#login"
            className={cn(
              "hidden text-sm font-medium sm:inline",
              themeTransition,
              isDark
                ? "text-white/95 hover:text-white"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Log in
          </Link>
          <Link
            href="#waitlist"
            className={cn(
              buttonVariants({ variant: "glass-outline", size: "glass-nav" }),
              "group [transition:background-color_0.5s_ease-in-out,border-color_0.5s_ease-in-out,color_0.5s_ease-in-out,transform_0.2s]",
              isDark
                ? "border-white/20! bg-white/8! shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]! hover:bg-white/14!"
                : "liquid-glass-on-light border-brand-purple/12! bg-white/25! shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]! hover:bg-white/38!",
            )}
          >
            Get Started
            <ArrowIcon
              className={cn(
                "text-base",
                themeTransition,
                isDark ? "text-white" : "text-brand-purple",
              )}
            />
          </Link>
        </div>
      </nav>
    </header>
  );
}
