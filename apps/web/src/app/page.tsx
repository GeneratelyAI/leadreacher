import dynamic from "next/dynamic";
import { connection } from "next/server";
import Hero from "@/components/landing/hero/Hero";
import { LandingMotion } from "@/components/landing/LandingMotion";
import Navbar from "@/components/layout/Navbar";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

const ProductStory = dynamic(() => import("@/components/landing/product-story/ProductStory"));
const LandingSections = dynamic(() => import("@/components/landing/remainder/LandingSections"));

export default async function Home() {
  await connection();
  const demoEnabled = isDemoOnboardingEnabled();
  return (
    <div className="landing-page relative min-h-dvh overflow-x-clip bg-brand-bg text-neutral-900">
      <Navbar />
      <Hero demoEnabled={demoEnabled} />
      <LandingMotion>
        <ProductStory />
        <LandingSections />
      </LandingMotion>
    </div>
  );
}
