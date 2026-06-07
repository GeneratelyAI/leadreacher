export default function HeroTransition() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative z-20 -mt-30 h-30 w-full sm:-mt-36 sm:h-36"
    >
      <div className="hero-transition-base absolute inset-0" />
      <div className="hero-transition-blur absolute inset-0 backdrop-blur-2xl backdrop-saturate-150" />
    </div>
  );
}
