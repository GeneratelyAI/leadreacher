import Image from "next/image";
import Link from "next/link";
import { ASSETS } from "@/lib/constants/brand";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#login", label: "Login" },
] as const;

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center">
          <Image
            src={ASSETS.logoWhite}
            alt="leadreacher"
            width={140}
            height={36}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="#waitlist"
          className="rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-light"
        >
          Book a Demo
        </Link>
      </nav>
    </header>
  );
}
