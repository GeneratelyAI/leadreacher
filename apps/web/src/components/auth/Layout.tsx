import Link from "next/link";
import Theme from "@/components/auth/Theme";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type LayoutProps = {
  children: React.ReactNode;
  campaign?: boolean;
};

export default function Layout({ children, campaign = false }: LayoutProps) {
  return (
    <main
      className={cn(
        "auth-page relative flex w-full flex-1 flex-col font-sans font-normal",
        "min-h-dvh",
        "overflow-x-hidden lg:overflow-hidden",
        campaign ? "bg-[#fdfdff] dark:bg-[var(--app-canvas)]" : "bg-white dark:bg-[var(--app-canvas)]",
        "px-0 py-0 lg:flex lg:h-dvh lg:max-h-dvh lg:items-center lg:justify-center lg:px-6 lg:py-6 xl:px-8 xl:py-8",
      )}
    >
      <Link
        href="/"
        className={cn(
          "absolute z-10 shrink-0",
          campaign
            ? "onboarding-brand-anchor inline-flex"
            : "onboarding-brand-anchor hidden lg:inline-flex",
        )}
        aria-label="leadreacher home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoColored}
          alt="leadreacher"
          className="landing-navbar-logo onboarding-brand-wordmark dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoWhite}
          alt="leadreacher"
          className="landing-navbar-logo onboarding-brand-wordmark hidden dark:block"
        />
      </Link>

      {!campaign ? (
        <div
          className={cn(
            "fixed z-20",
            "top-[max(1.25rem,env(safe-area-inset-top))] right-[max(1.25rem,env(safe-area-inset-right))]",
            "lg:top-6 lg:right-6 xl:top-8 xl:right-8",
          )}
        >
          <Theme />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-1 w-full",
          campaign
            ? "mx-auto max-w-[96rem] px-6 lg:px-10 xl:px-14"
            : "lg:max-w-6xl lg:px-8 xl:max-w-7xl xl:px-12",
        )}
      >
        {children}
      </div>
    </main>
  );
}
