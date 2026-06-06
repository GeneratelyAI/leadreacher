import FeatureSection from "@/components/landing/FeatureSection";
import HeroSection from "@/components/landing/HeroSection";
import HeroTransition from "@/components/landing/HeroTransition";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="relative overflow-x-hidden bg-brand-bg text-neutral-900">
          <HeroSection />
          <HeroTransition />
          <FeatureSection />
        </div>
      </div>
      <LandingFooter />
    </>
  );
}
