import Link from "next/link";
import { ASSETS } from "@/lib/constants/brand";

type AuthPageShellProps = {
  children: React.ReactNode;
};

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main
      className="relative flex min-h-full flex-1 flex-col items-center justify-center bg-[#F8F9FC] bg-cover bg-center bg-no-repeat px-4 py-12 sm:py-16"
      style={{ backgroundImage: `url(${ASSETS.authBackground})` }}
    >
      <Link
        href="/"
        className="mb-8 shrink-0 sm:mb-10"
        aria-label="leadreacher home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoColored}
          alt="leadreacher"
          className="h-7 w-auto sm:h-8"
        />
      </Link>
      {children}
    </main>
  );
}
