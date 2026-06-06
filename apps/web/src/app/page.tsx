import FeatureSection from "@/components/landing/FeatureSection";
import HeroSection from "@/components/landing/HeroSection";
import LandingFooter from "@/components/landing/LandingFooter";
import WaitlistForm from "@/components/landing/WaitlistForm";

export default function Home() {
  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="relative overflow-x-hidden bg-brand-bg text-neutral-900">
          <HeroSection />
          <div className="relative bg-brand-bg">
            <WaitlistForm />
          </div>
          <FeatureSection />
        </div>
      </div>
      <LandingFooter />
    </>
  );
}
