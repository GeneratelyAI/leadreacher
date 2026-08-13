import Link from "next/link";
import ThemeToggle from "@/components/auth/ThemeToggle";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main
      className={cn(
        "auth-page relative flex w-full flex-1 flex-col font-sans font-normal",
        "min-h-dvh",
        "overflow-x-hidden lg:overflow-hidden",
        "bg-white dark:bg-[var(--app-canvas)]",
        "px-0 py-0 lg:flex lg:h-dvh lg:max-h-dvh lg:items-center lg:justify-center lg:px-6 lg:py-6 xl:px-8 xl:py-8",
      )}
    >
      <Link
        href="/"
        className={cn(
          "absolute z-10 hidden shrink-0 lg:block",
          "top-6 left-6 xl:top-8 xl:left-8",
        )}
        aria-label="leadreacher home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoColored}
          alt="leadreacher"
          className="h-7 w-auto xl:h-8 dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoWhite}
          alt="leadreacher"
          className="hidden h-7 w-auto xl:h-8 dark:block"
        />
      </Link>

      <div
        className={cn(
          "fixed z-20",
          "top-[max(1.25rem,env(safe-area-inset-top))] right-[max(1.25rem,env(safe-area-inset-right))]",
          "lg:top-6 lg:right-6 xl:top-8 xl:right-8",
        )}
      >
        <ThemeToggle />
      </div>

      <div
        className={cn(
          "relative z-1 w-full",
          "lg:max-w-6xl lg:px-8 xl:max-w-7xl xl:px-12",
        )}
      >
        {children}
      </div>
    </main>
  );
}
