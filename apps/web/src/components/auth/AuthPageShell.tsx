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
        "relative flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden font-sans",
        "bg-[#ece8f3] bg-position-[center_40%] bg-cover bg-no-repeat font-normal",
        "px-4 py-4 h-compact:px-3 h-compact:py-2 lg:px-6 lg:py-6 xl:px-8 xl:py-8",
      )}
      style={{ backgroundImage: `url(${ASSETS.authBackground})` }}
    >
      <Link
        href="/"
        className={cn(
          "absolute z-10 shrink-0",
          "top-4 left-4 h-compact:top-3 h-compact:left-3",
          "lg:top-6 lg:left-6 xl:top-8 xl:left-8",
        )}
        aria-label="leadreacher home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoColored}
          alt="leadreacher"
          className="h-6 w-auto h-compact:h-5 lg:h-7 xl:h-8"
        />
      </Link>
      <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg">{children}</div>
    </main>
  );
}
