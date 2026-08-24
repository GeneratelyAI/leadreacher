import dynamic from "next/dynamic";
import Hero from "@/components/landing/hero/Hero";
import { LandingMotion } from "@/components/landing/LandingMotion";
import Navbar from "@/components/layout/Navbar";

const ProductStory = dynamic(() => import("@/components/landing/product-story/ProductStory"));
const LandingSections = dynamic(() => import("@/components/landing/remainder/LandingSections"));

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
