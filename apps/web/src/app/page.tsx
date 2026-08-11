import Hero from "@/components/landing/hero/Hero";
import ProductStory from "@/components/landing/product-story/ProductStory";
import LandingRemainder from "@/components/landing/remainder/LandingRemainder";
import { LandingMotionProvider } from "@/components/landing/LandingMotionProvider";
import Navbar from "@/components/layout/Navbar";

export default function Home() {
  return (
    <div className="landing-page relative min-h-dvh overflow-x-clip bg-brand-bg text-neutral-900">
      <Navbar />
      <Hero />
      <LandingMotionProvider>
        <ProductStory />
        <LandingRemainder />
      </LandingMotionProvider>
    </div>
  );
}
