import FooterBackground from "./FooterBackground";
import FooterNavColumn from "./FooterNavColumn";
import FooterSocialLinks from "./FooterSocialLinks";
import { Logo } from "@/components/ui/Logo";
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_TAGLINE,
} from "@/lib/constants/brand";

const FOOTER_SHELL_CLASS =
  "landing-footer -mt-16 sm:-mt-20 lg:-mt-24";
const FOOTER_INNER_CLASS =
  "relative z-10 pt-20 pb-20 sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28";
const FOOTER_CONTENT_CLASS = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";
const FOOTER_DIVIDER_CLASS =
  "pointer-events-none mb-12 h-[0.5px] w-full bg-[#69597b]/75 sm:mb-14";
const FOOTER_GRID_CLASS =
  "grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:gap-10 xl:gap-14";

export default function LandingFooter() {
  return (
    <footer className={FOOTER_SHELL_CLASS}>
      <FooterBackground />

      <div className={FOOTER_INNER_CLASS}>
        <div className={FOOTER_CONTENT_CLASS}>
          <div className={FOOTER_DIVIDER_CLASS} aria-hidden />

          <div className={FOOTER_GRID_CLASS}>
            <div className="sm:col-span-2 lg:col-span-1">
              <Logo size="md" align="left" className="h-8 sm:h-9" />
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-footer-text">
                {FOOTER_TAGLINE}
              </p>
              <div className="mt-6">
                <FooterSocialLinks />
              </div>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <FooterNavColumn
                key={column.title}
                title={column.title}
                links={column.links}
              />
            ))}
          </div>

          <p className="mt-16 text-sm font-medium text-white/70 sm:mt-20">
            {FOOTER_COPYRIGHT}
          </p>
        </div>
      </div>
    </footer>
  );
}
