import { ASSETS } from "@/lib/constants/brand";

const GRID_WIDTH = 1024;
const GRID_HEIGHT = 512;

export default function FooterBackground() {
  return (
    <>
      <div className="landing-footer__top-blend" aria-hidden />
      <div className="landing-footer__grid-wrap" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.footerGrid}
          alt=""
          className="landing-footer__grid-image"
          width={GRID_WIDTH}
          height={GRID_HEIGHT}
        />
      </div>
      <div className="landing-footer__horizon" aria-hidden />
      <div className="landing-footer__bottom-shade" aria-hidden />
    </>
  );
}
