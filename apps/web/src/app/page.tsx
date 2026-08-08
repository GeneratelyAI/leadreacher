import HeroSection from "@/components/landing/hero/HeroSection";
import ProductStorySection from "@/components/landing/product-story/ProductStorySection";
import LandingRemainder from "@/components/landing/remainder/LandingRemainder";
import Navbar from "@/components/layout/Navbar";

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-brand-bg text-neutral-900">
      <Navbar />
      <HeroSection />
      <ProductStorySection />
      <LandingRemainder />
    </div>
  );
}
