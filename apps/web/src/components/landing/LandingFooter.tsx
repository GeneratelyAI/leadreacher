import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";
import { FOOTER_LINKS } from "@/lib/constants/brand";

export default function LandingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-10 text-neutral-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:px-10">
        <div className="flex shrink-0 items-center justify-center lg:justify-start">
          <Logo size="sm" align="left" />
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-600 lg:flex-1 lg:justify-center"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="transition-colors hover:text-neutral-900"
            >
              {link}
            </a>
          ))}
        </nav>
        <ButtonLink
          href="#"
          variant="outline"
          size="sm"
          className="shrink-0 hover:bg-brand-purple/8"
        >
          Book a Demo
        </ButtonLink>
      </div>
    </footer>
  );
}
