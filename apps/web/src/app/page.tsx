import dynamic from "next/dynamic";
import { connection } from "next/server";
import Hero from "@/components/landing/hero/Hero";
import { Motion } from "@/components/landing/Motion";
import Navbar from "@/components/layout/Navbar";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

const Story = dynamic(() => import("@/components/landing/product-story/Story"));
const Sections = dynamic(() => import("@/components/landing/remainder/Sections"));

export default async function Home() {
  await connection();
  const demoEnabled = isDemoOnboardingEnabled();
  return (
    <div className="landing-page relative min-h-dvh overflow-x-clip bg-brand-bg text-neutral-900">
      <Navbar />
      <Hero demoEnabled={demoEnabled} />
      <Motion>
        <Story />
        <Sections />
      </Motion>
    </div>
  );
}
