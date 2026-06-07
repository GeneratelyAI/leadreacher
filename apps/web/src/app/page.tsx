import FeatureSection from "@/components/landing/features/FeatureSection";
import HeroSection from "@/components/landing/hero/HeroSection";
import LandingFooter from "@/components/landing/footer/LandingFooter";
import StatsBar from "@/components/landing/stats/StatsBar";
import WaitlistForm from "@/components/landing/waitlist/WaitlistForm";

export default function Home() {
  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="relative overflow-x-hidden bg-brand-bg text-neutral-900">
          <HeroSection />
          <div className="relative bg-brand-bg">
            <WaitlistForm />
            <div className="mx-auto w-full max-w-360 px-5 pb-8 sm:px-8 lg:px-12">
              <StatsBar />
            </div>
          </div>
          <FeatureSection />
        </div>
      </div>
      <LandingFooter />
    </>
  );
}
