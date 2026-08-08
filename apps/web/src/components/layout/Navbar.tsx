"use client";

import Link from "next/link";
import Image from "next/image";
import { FileText, ShieldCheck } from "lucide-react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { buttonVariants } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useNavbarTheme } from "@/hooks/useNavbarTheme";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
] as const;

const RESOURCE_LINKS = [
  {
    href: "/terms",
    label: "Terms of Service",
    description: "The terms that govern your use of LeadReacher.",
    icon: FileText,
  },
  {
    href: "/privacy",
    label: "Privacy Policy",
    description: "How we handle and protect your information.",
    icon: ShieldCheck,
  },
] as const;

const themeTransition = "transition-[color,opacity,transform] duration-slow ease-brand";

export default function Navbar() {
  const { isDark, scrollProgress, isVisible } = useNavbarTheme();
  const floatingProgress = isDark ? 1 : scrollProgress;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 pt-[calc(var(--nav-progress)*min(0.75rem,2vh))] px-[calc(var(--nav-progress)*min(1.25rem,3vw))] transition-transform duration-300 ease-out motion-reduce:transition-none"
      style={{
        ["--nav-progress" as string]: floatingProgress,
        transform: isVisible ? "translateY(0)" : "translateY(-110%)",
      }}
    >
      <nav
        className="relative flex w-full items-center justify-between gap-2 pl-3 pr-3 min-[360px]:pl-4 min-[360px]:pr-4 sm:pl-5 sm:pr-8"
        style={{ height: `${64 - floatingProgress * 4}px` }}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full backdrop-blur-xl transition-[background-color,box-shadow] duration-slow ease-brand",
            isDark
              ? "bg-[#111322]/90 shadow-[0_12px_32px_rgba(7,8,18,0.24),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-white/12"
              : "bg-white/86 shadow-[0_10px_32px_rgba(40,30,86,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#dcd8ec]/85",
          )}
          style={{
            opacity: floatingProgress,
            transform: `scale(${0.992 + floatingProgress * 0.008})`,
          }}
        />

        <Link
          href="/"
          aria-label="LeadReacher home"
          className="relative z-10 flex size-9 shrink-0 items-center justify-center md:hidden"
        >
          <Image src={ASSETS.planeIcon} width={24} height={24} alt="" className="size-6 object-contain" priority />
        </Link>

        <Link href="/" className="relative z-10 hidden shrink-0 items-center md:flex">
          <Logo
            size="xs"
            variant={isDark ? "white" : "colored"}
            align="left"
            crossfade
            className="h-5 max-w-[8.75rem] min-[360px]:max-w-44 sm:h-6.5 md:max-w-[13.5rem] lg:max-w-[15rem] xl:max-w-none"
          />
        </Link>

        <NavigationMenu
          aria-label="Primary navigation"
          className="absolute left-1/2 z-10 hidden -translate-x-1/2 md:flex"
        >
          <NavigationMenuList className="gap-5 lg:gap-7">
            {NAV_LINKS.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  render={<Link href={link.href} />}
                  className={cn(
                    "rounded-md bg-transparent px-1.5 py-2 text-sm font-medium hover:bg-transparent focus:bg-transparent data-active:bg-transparent 2xl:text-base",
                    themeTransition,
                    isDark
                      ? "text-white/95 hover:text-white focus:text-white"
                      : "text-neutral-600 hover:text-neutral-900 focus:text-neutral-900",
                  )}
                >
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}

            <NavigationMenuItem>
              <NavigationMenuTrigger
                className={cn(
                  "h-auto rounded-md bg-transparent px-1.5 py-2 text-sm hover:bg-transparent focus:bg-transparent data-popup-open:bg-transparent data-popup-open:hover:bg-transparent data-open:bg-transparent data-open:hover:bg-transparent 2xl:text-base",
                  themeTransition,
                  isDark
                    ? "text-white/95 hover:text-white focus:text-white"
                    : "text-neutral-600 hover:text-neutral-900 focus:text-neutral-900",
                )}
              >
                Resources
              </NavigationMenuTrigger>
              <NavigationMenuContent className="w-[340px] p-2">
                <ul className="grid gap-1">
                  {RESOURCE_LINKS.map((resource) => {
                    const Icon = resource.icon;
                    return (
                      <li key={resource.href}>
                        <NavigationMenuLink
                          render={<Link href={resource.href} />}
                          className="group/resource grid grid-cols-[2.25rem_1fr] gap-3 rounded-md p-3"
                        >
                          <span className="flex size-9 items-center justify-center rounded-md bg-brand-purple/8 text-brand-purple transition-colors group-hover/resource:bg-brand-purple/12">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">{resource.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{resource.description}</span>
                          </span>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-0.5 min-[360px]:gap-1 md:w-auto md:flex-none md:shrink-0 md:justify-end sm:gap-2 md:gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex min-h-11 items-center px-1 text-xs font-medium min-[360px]:text-sm md:hidden",
                themeTransition,
                isDark ? "text-white/95 hover:text-white" : "text-neutral-700 hover:text-neutral-900",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className={cn(
              "inline-flex min-h-11 items-center px-1 text-xs font-medium min-[360px]:text-sm md:px-0 md:text-sm 2xl:text-base",
              themeTransition,
              isDark
                ? "text-white/95 hover:text-white"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: "glass-outline", size: "glass-nav" }),
              "group min-h-11 px-2 text-xs min-[360px]:px-3 min-[360px]:text-sm md:px-4 transition-[background-color,border-color,color,transform,box-shadow] duration-base ease-brand hover:-translate-y-px active:translate-y-0 2xl:text-base",
              isDark
                ? "border-white/20! bg-white/8! shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]! hover:bg-white/14!"
                : "liquid-glass-on-light border-brand-purple/12! bg-white/25! shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]! hover:bg-white/38!",
            )}
          >
            Get Started
            <ArrowIcon
              className={cn(
                "hidden text-base md:inline-flex",
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
