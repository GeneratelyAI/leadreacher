import Link from "next/link";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type AuthPageShellProps = {
  children: React.ReactNode;
};

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main
      className={cn(
        "relative w-full font-sans font-normal",
        "min-h-dvh lg:h-dvh lg:max-h-dvh lg:overflow-hidden",
        "overflow-x-hidden overflow-y-auto",
        "bg-[#EEEEF8] lg:bg-[#ece8f3] lg:bg-position-[center_40%] lg:bg-cover lg:bg-no-repeat",
        "px-0 py-0 lg:flex lg:items-center lg:justify-center lg:px-6 lg:py-6 xl:px-8 xl:py-8",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden bg-position-[center_40%] bg-cover bg-no-repeat lg:block"
        style={{ backgroundImage: `url(${ASSETS.authBackground})` }}
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
          className="h-7 w-auto xl:h-8"
        />
      </Link>

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
