import Link from "next/link";
import AuthThemeToggle from "@/components/auth/AuthThemeToggle";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type AuthPageShellProps = {
  children: React.ReactNode;
};

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main
      className={cn(
        "auth-page relative w-full font-sans font-normal",
        "min-h-dvh lg:h-dvh lg:max-h-dvh lg:overflow-hidden",
        "overflow-x-hidden overflow-y-auto",
        "bg-[#EEEEF8] lg:bg-[#ece8f3] dark:bg-[#0a0a1a] lg:dark:bg-[#050209]",
        "px-0 py-0 lg:flex lg:items-center lg:justify-center lg:px-6 lg:py-6 xl:px-8 xl:py-8",
      )}
    >
      <div
        className="auth-page__bg auth-page__bg--light pointer-events-none absolute inset-0 hidden bg-position-[center_40%] bg-cover bg-no-repeat lg:block"
        style={{ backgroundImage: `url(${ASSETS.authBackground})` }}
        aria-hidden
      />
      <div
        className="auth-page__bg auth-page__bg--dark pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${ASSETS.authBackgroundDark})` }}
        aria-hidden
      />

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
          "top-5 right-5 lg:top-6 lg:right-6 xl:top-8 xl:right-8",
        )}
      >
        <AuthThemeToggle />
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
