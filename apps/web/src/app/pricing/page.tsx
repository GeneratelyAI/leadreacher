import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import PricingPage from "@/components/pricing/PricingPage";

export const metadata: Metadata = { title: "Pricing | LeadReacher", description: "Compare LeadReacher campaign options and choose the outreach workflow that fits your creative." };
export default function PricingRoute() {
  return (
    <div className="min-h-dvh bg-[#f7f6fb]">
      <Navbar />
      <PricingPage />
    </div>
  );
}
