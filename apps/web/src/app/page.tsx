import Hero from "@/components/landing/hero/Hero";
import ProductStory from "@/components/landing/product-story/ProductStory";
import LandingSections from "@/components/landing/remainder/LandingSections";
import { LandingMotion } from "@/components/landing/LandingMotion";
import Navbar from "@/components/layout/Navbar";

export default function Home() {
  return (
    <div className="landing-page relative min-h-dvh overflow-x-clip bg-brand-bg text-neutral-900">
      <Navbar />
      <Hero />
      <LandingMotion>
        <ProductStory />
        <LandingSections />
      </LandingMotion>
    </div>
  );
}
