"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { m, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";

import {
  ArrowRight,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FilePenLine,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Pause,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UserCheck,
  Users,
  Video,
  Zap,
} from "@/components/ui/icons";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { SocialMediaIcon } from "@/components/ui/SocialMediaIcon";
import type { TestimonialPreview } from "@/components/ui/3d-testimonials";
import { MorphingCardStack } from "@/components/ui/morphing-card-stack";
import { EdgeSurface } from "@/components/ui/edge-surface";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import { Logo } from "@/components/ui/Logo";
import { ScrollExpandMedia } from "@/components/ui/scroll-expansion-hero";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import AnimatedHighlightText, { Highlight, SparklesIcon } from "@/components/ui/animated-highlight-text";
import { MarkerHighlight } from "@/components/ui/marker-highlight";
import { PointerHighlight } from "@/components/ui/pointer-highlight";
import { BubbleText } from "@/components/ui/bubble-text";
import ShimmerText from "@/components/ui/shimmer-text";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/constants/brand";
import { BrowserBar } from "@/components/landing/hero/BrowserBar";
import HeroBreak from "@/components/landing/hero/HeroBreak";
import { ApprovalPreview } from "./ApprovalPreview";
import { FeatureList } from "./FeatureList";
import {
  checkoutStates,
  faqs,
  reviewCards,
} from "./content";

const testimonialPreviews = [
  {
    name: "Lisa Sullivan",
    role: "Managing Director, Vivo Digital Marketing",
    body: "LeadReacher has made a real impact on our clients' business and enhanced our service offering and reach. We're happy with the results and look forward to more.",
    initials: "LS",
    accent: "bg-[#eee9ff] text-[#5a32ed]",
  },
  {
    name: "Suzanne Sprajcar",
    role: "Director, SAS",
    body: "What LeadReacher did with our sales funnel was impressive. For a small monthly investment, they were able to open market channels for our sales team that we hadn't tapped yet and did not appear to have access to. We're happy with our decision to subscribe to their platform.",
    initials: "SS",
    accent: "bg-[#e9f2ff] text-[#3260ca]",
    avatarUrl: "/landing/testimonials/portraits.webp",
    avatarPosition: 0,
  },
  {
    name: "Mustafa S.",
    role: "Head of Performance Marketing, Accenture",
    body: "LeadReacher made a strong contribution to our growth marketing funnel. We launched a campaign utilizing their platform and started seeing results within the first 10 days. Their system works and our sales team is still using it today.",
    initials: "MS",
    accent: "bg-[#f2eaff] text-[#7641c9]",
    avatarUrl: "/landing/testimonials/portraits.webp",
    avatarPosition: 1,
  },
  {
    name: "Raphael Remhof",
    role: "Top Performance Coach, Think Beyond",
    body: "Systemization of pipelines is extremely difficult in our industry. However, our sales funnel experienced a new prospect flood thanks to LeadReacher's platform and their backend customer support made the experience an efficient and professional exchange.",
    initials: "RR",
    accent: "bg-[#e8f8f4] text-[#19765f]",
    avatarUrl: "/landing/testimonials/portraits.webp",
    avatarPosition: 2,
  },
  {
    name: "Auren Hoffman",
    role: "GP, Flex Capital and Mortgages",
    body: "LeadReacher empowered each of our agents with their own unique sales lead pipeline. The mortgage space is always crowded but LeadReacher's process was able to create the cut-through we need.",
    initials: "AH",
    accent: "bg-[#fff1e8] text-[#a34e20]",
    avatarUrl: "/landing/testimonials/portraits.webp",
    avatarPosition: 3,
  },
  {
    name: "Basil M.",
    role: "Senior Director of Sales, Lodgify",
    body: "Their system worked so effectively we needed to hire dedicated intake to respond. Genuinely amped up our sales funnel and opened up new avenues in our market penetration.",
    initials: "BM",
    accent: "bg-[#f0edff] text-[#5c3ad1]",
  },
  {
    name: "Ben Bolsinar",
    role: "Senior Consultant, Portameo",
    body: "Currently finalising a $450,000 agreement that started with LeadReacher's contribution to our pipeline. Their campaigns are consistent and the customer service approach is responsive and supportive.",
    initials: "BB",
    accent: "bg-[#e9f2ff] text-[#3260ca]",
  },
  {
    name: "Dacoda M.",
    role: "Co-Founder, FoondaMate",
    body: "Supported our Series B by growth hacking our LinkedIn business page and increased our sales CRM pipeline. Noticeable increase in sales numbers which supported optics and investor value.",
    initials: "DM",
    accent: "bg-[#e8f8f4] text-[#19765f]",
    avatarUrl: "/landing/testimonials/portraits.webp",
    avatarPosition: 4,
  },
  {
    name: "Jamie Fleishman",
    role: "Director of Sales, Joyn Insurance",
    body: "Strongly supported our capital raising outreach campaign then streamlined our pipeline of leads. Relationships developed through LeadReacher have either led to direct close deals or advanced into referrals. Their process and strategy works.",
    initials: "JF",
    accent: "bg-[#f2eaff] text-[#7641c9]",
  },
] satisfies readonly TestimonialPreview[];

const ThreeDimensionalTestimonials = dynamic(
  () => import("@/components/ui/3d-testimonials").then((module) => module.ThreeDimensionalTestimonials),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="h-[28rem] w-full" />,
  },
);

function DeferredTestimonials({
  testimonials,
  className,
}: {
  testimonials: readonly TestimonialPreview[];
  className?: string;
}) {
  const reference = useRef<HTMLDivElement>(null);
  const shouldRender = useInView(reference, { margin: "400px 0px", once: true });

  return (
    <div ref={reference} className={className}>
      {shouldRender ? (
        <ThreeDimensionalTestimonials testimonials={testimonials} />
      ) : (
        <div aria-hidden="true" className="h-[28rem] w-full" />
      )}
    </div>
  );
}

const APPROVED_API_WORLD_MAP_PATH = "M426.9,413.1L434.9,416.2L435.5,415.1L435.5,413.4L436.9,412.3L438.4,412.6L447.1,417.8L439.8,419.7L426.9,413.1ZM708.6,405.4L709.9,402.5L711,403.3L712.8,403.6L708.6,405.4ZM871.9,387.2L873.3,382L880.4,382.5L876.3,388.6L871.9,389.4L871.9,387.2ZM909.6,396.3L929.7,382.7L933.7,382.6L926.9,390.2L918.2,395.5L915.8,396.7L914.2,397.4L909.6,396.3ZM934.5,383.6L937.1,381.4L937.3,380L935.6,378.9L940.7,373.3L941.3,365.6L941.7,367.1L943,367.8L942.3,370.1L942.3,372.9L943.4,371.1L944.3,374.7L948.3,374.2L937.3,383.6L934.5,383.6ZM936.2,327.9L941.5,333.3L938.2,332L936.2,327.9ZM967.2,322.8L967.3,321.6L968.4,320.7L970.6,321.4L967.2,322.8ZM667.8,333L670.7,327.8L671.5,317.7L679.1,313.4L682.8,306.7L685.2,315.1L675.6,340.6L673.8,341.2L671.8,342.3L670.6,341.7L668.9,340.7L667.8,333ZM817.8,365L821.2,359.7L820.3,343.7L821,344.8L820.9,342.4L821.8,343.2L822.2,344.2L821.5,339.1L824.7,332.2L824.4,334.2L830.9,329.4L840.6,326.8L853.8,312.4L857.1,311.4L862.3,314.4L865.5,308L870,306.9L869.9,304.3L876.1,307.2L878.9,306.2L875.5,314.5L884.7,321.6L889.3,314.6L892.8,303.1L894.5,313.3L896.1,312.3L896.7,313.4L897.6,314.4L897.7,324.9L902.3,328.6L902.8,333.8L905.1,333.9L907.5,343.6L901.5,358.2L888.6,373.5L878.8,377.7L877.6,376.5L876.5,376.1L877.5,374.7L876.1,375.2L873.4,377.1L868.1,375L868.1,370.1L867.5,369L865.6,368.7L866.8,367.4L867.1,365.5L865.3,367.3L863.2,367.8L867.8,361.6L861.8,366.8L860.5,360.8L855.2,357.9L843.4,359.8L836.5,364.2L828.4,364.4L823.4,367.3L817.8,365ZM840.2,300.2L842.3,299.7L843.9,302L843,302L840.2,300.2ZM934.2,297L935.9,300.8L934.5,298.5L934.2,297ZM850.1,302L854.1,297.8L859.3,297.2L850.1,302ZM835.3,298.8L838.1,296.4L840.7,298L835.3,298.8ZM810,293.1L811.7,290.6L817.4,292.9L821.7,293.2L822.2,292.1L833.1,297.1L830.4,298.1L810,293.1ZM907.2,290.2L911.4,288.3L911.5,289.7L912.8,289.5L914.7,286.1L916,286L916.5,286.5L916.3,287.9L915.5,289.5L911.4,291.7L907.2,290.2ZM861.3,284.1L861.9,282.6L864.7,282.5L867.2,283.3L867.9,285.3L861.3,284.1ZM867.4,277.6L875.2,277.2L875.6,278.2L876.1,282.4L878.4,284L885,279.6L899,285.3L905.6,291.1L904.3,294.5L911.3,302.9L905.2,301.7L898.7,295.1L893.5,299.6L885.9,296.4L885.3,297.1L882.4,297.2L883.6,295.1L885.1,294.3L884.7,291.5L883.8,289.3L874.4,284.4L873.6,285.7L872.8,285.9L870.6,282.6L874.5,281L871.2,281L867.4,277.6ZM840.7,282.5L845.6,271.8L852.8,272.8L855,270.9L855.5,271.5L853.7,274.1L844,274.6L843.7,276.5L845.7,278.9L847,277.7L851.2,276.8L847,280.2L850.4,289.2L849.2,289.9L848.3,289L849.5,286.9L847.3,287.9L846.7,287.1L845.7,282.1L842.8,290L840.7,282.5ZM860.3,272.5L860.8,270.4L861.5,269.5L863.3,272.2L861.9,277.5L861,275.9L860.3,272.5ZM787.5,260.8L788.9,260.9L792.4,261.5L807.1,274.9L806.2,277L812.1,283.2L811.4,286.4L811.2,290.5L804,286.2L787.5,260.8ZM818.6,274.1L818.9,271.7L820.2,269.9L821.9,270.8L823.6,270.3L824,268.1L825,267.6L827.7,267.1L835.6,257.1L841.4,261L837.4,266.7L841.3,272.8L838.7,273.1L834.7,285.7L821.4,282.9L818.6,274.1ZM847.3,256.4L850.5,252.4L854.9,251.7L854.6,249.6L856.6,250.9L857.7,256.4L857.1,258.8L856.1,256.1L855.2,257.4L856,259.4L855.4,260.6L851,254.7L847.3,256.4ZM751.9,253.7L752.7,249.5L756.5,258.2L755.6,259L753.7,259.6L752.5,257.5L751.9,253.7ZM847.8,249.8L851.2,245.8L849.4,251.6L847.8,249.8ZM836.4,253.3L840.9,245.4L841.5,247.6L836.4,253.3ZM846.1,244L847.5,244.9L849,244.9L846.8,247.9L846.1,244ZM851.2,242.3L853.4,242.4L854.1,243.3L855.1,246.3L853.3,245.6L853.1,248.7L851.2,242.3ZM842.1,239.9L844,240L844.9,241L844.6,243.2L843.5,241.9L842.1,239.9ZM840,232.3L840.9,226.7L844.3,226.8L844.9,237.7L850.1,239.1L850.8,242.4L842.6,238.9L840,232.3ZM406.5,227.1L411.3,226.3L409.8,223L415.1,223.1L420.2,226.4L415,226.9L414.2,227.3L413.1,229.1L406.5,227.1ZM813.6,224.4L814.5,223.2L816.8,222.5L818.1,222.6L818.7,223.6L816,227.5L814,226.7L813.6,224.4ZM225.6,225.2L226.7,222.1L228.4,224.1L225.6,225.2ZM384.4,217.8L388.6,214.9L394.5,214.6L407.7,222L399.6,223.1L401.3,221.7L398.1,218.6L391.7,215.8L384.4,217.8ZM400,210.7L400.7,209.1L401.4,209.2L401.8,211.3L401.6,212.9L400,210.7ZM836.8,213.4L837.5,210.8L838.7,208.8L839.1,217.6L837.5,215.4L836.8,213.4ZM855.6,187.3L857.9,184.9L859.7,185.5L860.4,186.4L857.7,189.3L856,188.6L855.6,187.3ZM640.9,183L645.7,181.5L642.6,184.4L641.5,184.1L640.9,183ZM598.4,176.4L604.9,174.8L604.2,179L598.4,176.4ZM589.2,167.7L590.3,167.8L591.4,167L592.7,168.8L592.5,172.3L589.9,172.3L589.7,169.2L589.2,167.7ZM849.4,187.8L854.1,182.1L858,181.3L860.5,181.9L860.7,177.2L862.7,178.5L864.6,175.8L865.3,174.8L865.1,171.6L863.3,168.7L863.4,167L865.3,166.6L868.3,170.2L869.3,172.3L870.6,182.9L868.4,184.1L864.8,184.3L862.9,187.3L861.1,186.3L860.2,184.3L852.2,186.2L855.1,188.1L855.3,192.6L854.3,193.7L849.4,187.8ZM589.9,164.3L590.3,163.3L591.6,162.3L592,164.5L591.4,166.6L590.4,166L589.9,164.3ZM860.5,161.5L862.6,161.3L861.2,157.7L860.6,155.7L864.6,158.4L866.6,159.3L868.4,159.8L869.2,158.8L871.3,161.7L868.7,162.4L868.3,165L864.1,163.2L864.4,166L862.2,166.1L860.5,163.5L860.5,161.5ZM442.3,152.7L446.9,153.4L445.6,154.5L444.8,154.7L442.5,153.6L442.3,152.7ZM318.5,144.4L318.5,143L319.1,142.4L323.5,143.6L325.4,148.2L318.5,144.4ZM453.1,149.7L463.5,140.4L459.6,144.8L465.8,146.3L465.1,152.9L464.1,153L462.9,152.5L463.8,150.4L463.4,150.1L460.5,152.3L459.3,152.2L461,151L453.1,149.7ZM314.1,135.8L317.8,134L315.4,136.9L315.7,138.9L314.1,135.8ZM846.7,133.8L860.6,147L857.1,146.1L862.9,154.2L860.4,152.7L860.3,154.7L846.7,133.8ZM552.7,139.8L554.4,137.2L553.5,134.6L556.2,132.7L557.7,131.5L559.3,131.4L561.3,133L559,138.7L555.5,140.2L552.7,139.8ZM593.1,129.9L595.8,129.1L596.5,130.4L595.5,132.4L593.4,131L593.1,129.9ZM560.6,127.5L561.4,125L562.9,123L564.4,123.2L566.6,123L564.6,125.6L566.5,125.3L568.6,125.3L568,127.3L566.3,129.5L575.5,137.5L575.1,141.1L560.8,144L563.8,141.3L565.5,140.8L562.5,140.3L561.9,139.3L564,138.6L563,137.2L563.4,135.6L566.2,135.8L566.6,134.4L565.3,132.8L562.9,132.4L562.6,129.9L561.5,131.1L561.5,128.7L560.6,127.5ZM419.6,113.9L421.5,112.8L424,112.9L419.6,113.9ZM415.2,111.4L420.4,106.3L428.2,111L415.2,111.4ZM529.2,106.6L530.6,105.1L533.3,104.8L535.9,106.3L546.7,104.7L546.2,106.2L548.1,107.7L538.6,111.5L536.3,111.1L531.4,110.4L533.3,109.4L529.6,108.3L532.8,107.8L532.8,107.1L529.2,106.6ZM437.7,103.2L437.8,102.1L439.2,100.9L441,100.6L442,101.2L437.7,103.2ZM251.9,108.1L262.9,99.1L265,100.8L266.8,103L265,104.4L265.5,105L267.1,103.3L271.4,103.7L272.4,105.8L262.6,109.7L255.9,107.1L255.9,106.3L257.3,105.5L251.9,108.1ZM401.4,98.1L403.4,97.4L405.2,96.4L408.1,98.7L401.4,98.1ZM254.6,133.3L279,122.3L269.3,122.9L271.2,119.8L267.2,118.5L270.2,114.8L285.7,108.5L277.4,109.3L274.8,106.5L278.3,105.5L283.5,104.4L287.3,105.5L284,100.4L297.4,96L309,93.8L337.5,99.2L355.1,95.7L356,95.9L357.1,97.9L360.7,96.4L359.5,98.1L374.1,99.2L375.5,100.3L372.2,101.4L374.9,101.9L382.4,102.6L389.5,99.4L395.8,102L403.8,99.9L406,100.7L404.5,102.8L410.4,98.8L409.5,97.5L408.1,96.6L410,94.1L413.1,92.6L415,92.9L416.1,93.9L416.7,96.3L414.5,97.4L417.4,97.9L415.9,100.1L419.3,98.4L420.5,99.8L418.9,101.5L419.7,103L426.5,97L432.8,98.6L430,103.2L421.6,104.5L398.9,117.6L397.1,119.5L395.5,122.2L398,122.6L397.7,124.9L397.6,126.8L414.5,131.5L413.2,133.6L412.8,136.1L413.1,138.9L415,141.3L416.9,140.5L418.9,137.9L419.5,134L418.7,132.7L426.9,128.1L425.5,122.6L428.9,120.1L429,117.9L430.2,114.2L438.1,113.9L444.4,117.2L443.5,119.2L442.9,122.2L444.5,122.6L445.3,124L452.9,118.9L456,127L454.7,128.6L463.5,135.2L464,136.2L463.3,139L461.7,139.9L460,140.8L456.5,141.7L453.5,143.8L440.9,143.8L428.8,152.5L442.8,146.3L444.2,147.6L441.8,149.3L441.6,152L441.8,154L444,155.3L447.5,154.9L450.3,152L449.9,153.9L451,154.8L438.1,160.9L436.6,160.7L437.1,158.5L441.2,156.4L437.9,156.5L435.6,156.8L428.5,160.6L426.1,164.1L427.4,165.9L418.5,168.2L415.3,172.9L414.3,171.5L412,177.4L412.4,172.4L410.5,174.8L411.4,181.8L397,192.6L395.9,209.1L393.3,207.3L390.2,196.2L379.4,195.6L376.6,198.8L368.9,197.2L360.6,202.2L356.1,216.3L358.3,224.6L362,227.6L370.5,224.6L372.3,220.1L379.7,218.7L373.5,233.6L382.3,233.3L385.7,235.2L383.8,246.1L387,251.6L393.1,250L399.1,252.6L403.8,246.2L411.1,242.6L411.9,242.8L412.5,243.5L410.5,245.3L410.7,251.4L411.7,246.5L415.2,243.3L418.8,247.6L426.2,248.8L433,247.1L431.1,247.9L431.8,249.1L443.2,259.6L450.4,260.1L456.3,264.2L459.2,270.6L459.3,272.4L457.6,274.6L458.3,275.4L462.3,275.8L462.4,278.4L464.1,276.7L466.9,277.6L470.7,279.2L471.8,280.8L471.5,282.2L481.9,282.7L492.7,289.5L493.1,298.7L485.5,309.4L481.7,332.7L480,333.8L479.6,335.4L467.6,340.4L466,350.4L457.5,365.5L452.5,366.7L447.4,364.2L452.1,370.8L452.2,372.1L450.8,375.5L441.5,377.1L443,382L437,383L441.4,386.9L439.7,387.7L438.5,389.3L438.8,391.9L438.7,393.3L436.8,393.3L435.5,394.6L440.1,401.2L435.8,407.8L437.3,410.5L439.1,411.9L434.4,413.3L434.9,415.6L425.8,411.7L421.3,402.6L421.3,400.2L422.8,398.2L419.5,397.4L420.7,395.2L420.1,390.9L422.6,391.8L422.2,386.4L420.6,385.7L420.9,389L419.5,388.6L416.9,372.8L418.8,360.3L415.6,323.3L402.1,313.5L392.3,294L390.5,292.3L388.8,291.2L389.5,290.1L388.3,287.6L391.9,282.1L389.2,281.1L389.6,280.3L389.2,277.9L397.9,265.1L396,253.4L393,251.8L389.8,256.3L379.4,249.2L376,240.4L367.8,238.7L360.7,232.7L356.4,234.2L341.8,227.3L338.1,222.9L338.3,215.5L332.8,208.1L326.9,192.3L326.2,192.4L325.2,191.7L324.1,196L331.2,213.9L331,214.4L329.9,215.4L325.9,210.3L326.4,208.4L326.4,206.9L321.5,202.4L324,200.2L322.9,198.3L321.8,197.6L320.8,188.4L315.1,184.3L313,172.9L322.6,149L323.1,148.5L325.5,149.4L325.3,151.8L327.4,146.9L321,142.3L321.3,140L322.5,138.5L320.7,137.4L320.4,124.2L301.6,117.6L289.5,121.8L296,116.7L270.2,129.4L254.6,133.3ZM371.9,93.4L382.3,89.6L383.6,90L381.9,91L390.3,90.3L391.3,91L390.9,93.2L394.8,89.8L396.2,90.1L397.3,91L396.7,93.1L396,94.6L398.1,95.7L400.4,96.7L395.8,99.5L376.7,100L372.4,96.8L381.5,96L372.5,95.6L372.3,94.8L377,93.9L374.4,93.9L371.9,93.4ZM396.2,89.3L400.1,89.4L397.5,90.8L396.2,89.3ZM420.9,95.1L423.3,94.1L421,94.1L421.9,91.9L424.5,90L426.8,89.1L431.4,88.6L429.3,89.9L429.7,91.3L432.4,89.5L437.1,88.7L438.5,90.9L437.4,92.3L441.1,91.6L443.2,90.8L455.7,95.6L456.7,96.5L457.4,98.6L453.7,99.6L463.9,103.8L462.7,105.4L458.5,108L452.5,105.1L455.6,111.7L454.3,113.4L452.3,112.8L448.6,110.9L451.5,115.2L447,114.2L443.7,112.9L438.7,108.8L432,109L441.1,107L445.5,102.8L440,99.2L441.4,98.6L440.4,97.3L420.9,95.1ZM401.9,91.3L412.4,88.7L412.3,89.3L410,90.3L411.8,91.2L410.1,93.1L406.8,94L405.3,93.8L404.7,93L401.9,91.3ZM413,92.3L415.6,88.4L423.8,88.4L413,92.3ZM361.6,92.7L368.3,87.5L382.1,89.3L364.4,94.8L364.4,93.8L361.6,92.7ZM808.2,85L811.6,85.3L816.3,85.9L808.2,85ZM415.2,86.2L416.8,85.3L419.6,84.7L420.4,85.4L420.5,86.1L415.2,86.2ZM792.9,84.1L806,84.9L806.6,86.4L800.5,86.4L798.4,86.9L793.6,85.5L792.9,84.1ZM407.1,84.9L408.4,83.3L416,83.5L415.1,84.5L413.1,86.1L407.1,84.9ZM381.9,85.6L386.1,83.6L388.2,83L392,83.7L393.7,84.9L396.4,85.1L395.9,83.1L398.1,82.4L399.1,84.3L400.8,84L402.4,84.1L389.2,87.3L386.7,87.3L387.1,86.6L391.4,85.7L383.8,86L381.9,85.6ZM658.2,92.4L662.3,85.9L682,82.9L667.7,87.5L666.2,89.6L664.5,91.6L665.6,93.4L669.5,95.2L668.6,95.4L663,95.1L658.2,92.4ZM417.8,82.5L442.9,85.4L438.6,87.2L426,87.1L422.2,86.4L422.2,83.4L419.1,83.1L417.8,82.5ZM375.5,83.8L389.3,80.7L387.5,82.2L385.5,82.9L375.5,83.8ZM532.8,236.6L536,230.2L534.5,220.1L537.1,213L543.6,202.7L551.5,196.6L552.3,189.7L559.7,181.3L567.6,182.8L575.3,179L592.3,177.1L595.7,178.3L594.4,186.5L613.5,195.7L615.5,190.5L617,189.3L618.5,188.9L634.7,194.1L646.7,192.4L648.7,178.9L641.2,180.4L630.7,178.9L627,171.6L632.9,167L641.5,164.9L651.9,167.7L658.3,166.1L658.5,165L657.7,163.3L646.9,156.5L651,151.3L643,153.9L646.2,156.9L644.1,157.3L641.5,158.8L638.2,156.3L639.7,154.4L634.4,153.1L629.3,163.4L632.1,167.4L627.2,169.8L624,167.7L621.6,168.4L623.1,169.8L622.1,170.3L619.4,169.5L622.7,174.8L620.3,177.2L621.3,179.5L619.9,179.6L618,178.4L612.7,169.5L612.3,165.3L598.9,155.3L597.3,156.2L598,159.5L610.8,169.7L607.4,169L608,173L607.1,173.2L606.1,175.4L604.4,170L590.4,158.8L585.7,162L581.6,161.3L578.6,162.1L578.4,163.7L578.5,165.2L576.6,167L573.9,167.5L572.5,173.5L567.7,178.9L560.8,180.8L558.5,178.2L553.4,178.4L552.9,162.3L555.9,160.4L568.3,161.2L569.4,159.7L569.8,154.5L563.1,147.7L565.7,147.2L569,147.8L568.4,144.9L570.3,146L574.9,144L581.4,136.6L588,135.5L588.4,126.7L592.2,125.2L593,128.3L590.7,130.7L593.4,134.3L610.1,133.3L610.5,132.2L613,131.4L613,126L617.9,126.9L618,125L618,123.6L615.7,121.7L626.2,119.7L614.6,120.1L613.4,118.8L611.5,118L611.1,112.2L617.4,107.8L617,106.8L614.4,105.7L604.6,113.2L603.6,116.5L605.1,118.2L607,119.5L605.6,122.2L603.7,122.8L603.4,126.9L602.5,129.2L597,131L591.5,121L588,123.8L585.5,124.3L582.8,123.1L582.1,120.5L581.3,115.1L605,97.2L619.7,94.2L625.3,95.8L623.2,96.4L625.4,97.7L642.1,101.4L643.8,102.4L644.3,103.9L642.7,105.1L630.5,104.3L633.7,106L634.7,109.4L637.2,110.1L638.7,110.7L638.3,107.7L643,109.1L644.3,108.6L642.7,106.9L646.2,104.6L647.9,104.8L649.7,105.6L647.2,99.9L652.3,100.6L653.6,104.2L664.7,99.3L666,99.4L664.8,100.8L673.4,99.2L675.9,100.6L677.2,99.1L674.9,97.8L675.5,97.1L690.9,101L684.7,94.5L687.9,90.2L692.6,90.7L693.6,91.9L693,93.7L699.5,100.3L699.5,101.8L697.7,105L699.8,105.3L702.6,101.7L695,93.6L697.2,92.1L696,90.6L700.8,94.2L699.2,92.7L708.7,92.9L706.1,91.2L704.6,88.9L714.5,88.3L712.4,87.2L713.4,85.8L733.1,83.1L736.4,80.6L755.6,84.3L751.1,87.8L776.1,90.3L774.6,88.7L778.5,89.1L781.1,89.1L794.1,95L793.5,92.8L807.1,93.5L803.8,91.5L805,90.6L840.8,94.9L847.7,98L859.1,97.7L864.4,99.7L865.7,98.9L862.6,97.5L862.2,96.5L878,98.1L881.6,99.1L892.6,108.1L889,108.9L898.3,114.3L889.8,115.8L888,120L883.7,118.4L875.4,120L876.3,121.6L876.2,123.9L877.2,124.9L879.8,125.5L883.8,132.2L881.5,133.5L883.1,136.3L880.7,136.9L882.1,139.5L881,141.8L867.9,127.5L868.3,126.1L867.4,124.9L869.8,124.4L872.7,117L870.8,113.7L868.8,113.9L869.7,115.8L867.6,118.4L863.2,115.5L859.3,116.3L858.4,120.3L861.2,121.8L837.5,122L835.2,126.7L832.1,132.5L839.7,134.9L840,133.7L842.3,133.9L847,136.6L852.3,148.3L849.2,161.3L847.3,162.8L846,162.9L844,161.6L838.6,170.8L846,178.6L847.2,181.6L847,183.1L842.1,184.9L838.9,178.7L840.3,178.3L834.5,175.1L834.2,171.3L832.9,171L831.6,170.3L826,173L826.6,169.1L824.9,167.7L818.8,173.5L825,177.6L826.6,175.7L828.9,176.8L830.2,176.8L831.1,178.2L828.4,178.9L826,183.5L834.7,192L837.1,201.1L833,210.8L830.5,213.2L827.9,215.4L817.4,219.1L817.2,221.9L812.2,218.3L807.3,223.4L815.8,235.2L817.4,240L817.6,244.6L815.9,246.4L809.2,252.7L808.3,251L808.8,249.2L796.7,240.1L795.8,251L804.8,260.7L807.9,271.8L801.5,268L798.2,258.3L794.3,253.2L794,254.8L794.2,245.2L789,230.8L787.8,232.2L785.4,234L784.2,233.8L782.7,233.2L783.1,229.9L782.3,227.5L774,215.5L771.9,215.4L772.3,216.5L771.8,217.9L764.7,218.8L765.1,220.8L764.1,222.4L755.7,231.8L751.8,233.5L751.9,248.1L747.1,254.3L736.6,233.3L733,219.2L730,220.8L728.4,220.5L717.8,208.5L707.2,209.4L698,207.7L696.7,204.4L695.6,204L689.1,204.8L678.1,195.6L677.4,196.6L676.1,196.5L677.5,200.2L683.8,210.3L683.5,208.3L683.9,207L684.5,206.7L685.3,207.5L686.2,212.2L691,211.9L695.5,205.9L697.2,211.6L704.3,216.7L700.5,222.1L700.5,225.5L695.5,230L681.3,238.5L669.9,242.1L667.4,231.2L658.9,219.4L657,213.1L647.6,201.6L648,197.7L646.2,202.6L642.5,196.8L650.6,214.6L653.3,217L653.7,217.5L655.6,226.4L669.5,242.7L669.5,243.8L668.2,244.5L672.6,247.8L687.1,243.7L687.1,247.3L680.1,264.1L663.3,281.9L660.8,287.4L660.6,297.4L663.3,303.4L662.8,315.5L649.5,327L650.6,337.3L643.6,342.7L642.2,350.6L632.8,361.2L627.3,364.3L620.5,364.1L614,366.6L611.2,364.1L611.5,358.3L605.5,346.3L603.7,333.1L598.5,322.5L603,303.3L599.2,288.4L592.1,278.1L593.5,265.4L591.4,262.7L585.6,264L582,258.8L567.8,262.9L561.7,261.7L554.2,263.8L543,254.8L534.9,243.3L532.8,236.6ZM667.5,158.2L677.3,169.5L674.7,173.3L675,174.5L675.9,176.5L686,178.1L685.2,172.9L682.2,170.1L682.2,167.9L684.3,168.5L686,167.7L684.1,166.1L683.2,164.6L681.7,165.3L681.9,167.2L680.4,162.9L674.9,158.2L680.2,156.5L680,154L679.2,152.4L671.5,153.6L667.5,158.2ZM396.7,79.2L401.5,78.8L399.2,79.2L396.7,79.2ZM418.6,79.8L418.6,79.1L419.2,78.3L423.2,79.2L418.6,79.8ZM408.1,79.3L409.4,77.5L416,79.4L408.1,79.3ZM728.3,80.2L728.6,77.6L729.7,77.4L736.4,79.4L728.3,80.2ZM588.3,76.9L598.2,76.1L600.3,76.8L605.6,78.2L597.5,82.4L588.3,76.9ZM598.7,75.6L614.1,76.1L612.1,77.1L607.7,77.3L598.7,75.6ZM711.1,75.6L713.7,74.4L716.5,74L727.3,78.3L711.1,75.6ZM424.6,75.9L433.3,73.9L439.9,77.4L427.2,79.3L428.6,77.4L424.6,75.9ZM429.5,83L433.7,80.2L434.8,80.1L438.3,80.9L437.2,79.7L434.9,79.3L441,77.4L439.5,76.7L439.7,75.7L447.8,75.4L444.6,75.1L439.2,75.3L435.8,72.8L456.3,70.8L481.1,71.6L453.6,77.5L455.5,77.7L443.3,83.6L429.5,83ZM457.4,79.9L471,77.3L472,76.7L468.4,76L478.7,73.1L505.7,73.2L502.7,72.3L516.2,70.1L541.6,71.5L524.9,72.3L539.3,73.1L537.4,74.1L553.9,73.9L541.7,75.9L545.2,76L543.1,77.3L541.6,78.6L541.3,80.7L542.9,82L540.5,82.1L537.7,82.7L540.5,83.8L540.6,85.5L538.8,85.7L540.6,87.5L533.4,89.6L535.2,91.1L535.1,92L531.9,91.1L531,91.7L535.4,95.3L529.3,93.6L529.6,95.1L527.5,96.3L531.9,96.4L534.2,96.5L501.7,107L494.6,113.4L492,119.5L483.4,117.7L479.3,111.2L478,103L485.6,96.9L478.8,97.6L479.3,96.1L480.4,95L482,94.9L485.2,95.5L478.7,93.1L481.4,91.1L477.8,85L462.5,83.9L461,83.2L459,82L463.6,81.3L466.8,81.2L460.4,80.7L457.4,79.9Z";

function scrollToApproval(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const target = document.getElementById("approval-review");
  if (!target) return;

  const targetTop = target.getBoundingClientRect().top + window.scrollY - 24;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetTop);
    return;
  }

  const startTop = window.scrollY;
  const distance = targetTop - startTop;
  const duration = 1_050;
  const startedAt = performance.now();
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";

  const animate = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, startTop + distance * eased);

    if (progress < 1) {
      window.requestAnimationFrame(animate);
    } else {
      root.style.scrollBehavior = previousScrollBehavior;
    }
  };

  window.requestAnimationFrame(animate);
}

function DataLensWord() {
  const updateLens = (event: MouseEvent<HTMLSpanElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--data-lens-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--data-lens-y", `${event.clientY - bounds.top}px`);
  };

  return (
    <span
      onMouseMove={updateLens}
      onMouseLeave={(event) => {
        event.currentTarget.style.setProperty("--data-lens-x", "50%");
        event.currentTarget.style.setProperty("--data-lens-y", "50%");
      }}
      className="group/data relative isolate inline-block text-[#5a2ff4]"
      style={{ "--data-lens-x": "50%", "--data-lens-y": "50%" } as CSSProperties}
    >
      <span aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-1 -z-10 rounded-[45%] opacity-0 blur-[1px] transition-opacity duration-300 group-hover/data:opacity-100 motion-reduce:transition-none [background-image:radial-gradient(90px_circle_at_var(--data-lens-x)_var(--data-lens-y),rgba(82,157,255,.24),transparent_70%),radial-gradient(rgba(91,47,244,.28)_0.7px,transparent_0.8px)] [background-size:auto,8px_8px]" />
      <span aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-clip-text text-transparent opacity-0 transition-opacity duration-200 group-hover/data:opacity-100 motion-reduce:transition-none [background-image:radial-gradient(90px_circle_at_var(--data-lens-x)_var(--data-lens-y),#79d8ff_0%,#6576ff_42%,#a45cff_78%)]">data</span>
      <span className="relative z-0">data</span>
      <svg aria-hidden viewBox="0 0 190 22" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-2 left-0 h-4 w-full overflow-visible">
        <path d="M2 16 C28 16 34 10 54 12 S82 19 101 10 S131 17 150 8 S174 10 188 3" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
        <path d="M2 16 C28 16 34 10 54 12 S82 19 101 10 S131 17 150 8 S174 10 188 3" fill="none" pathLength="1" stroke="url(#data-line-gradient)" strokeLinecap="round" strokeWidth="2.5" className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none [stroke-dasharray:1] [stroke-dashoffset:1] group-hover/data:[stroke-dashoffset:0]" />
        <defs><linearGradient id="data-line-gradient" x1="0" x2="1"><stop stopColor="#5a2ff4" /><stop offset="0.55" stopColor="#5c9cff" /><stop offset="1" stopColor="#79d8ff" /></linearGradient></defs>
      </svg>
    </span>
  );
}

type OutreachModelKey = "diy" | "agency" | "leadreacher";

const outreachModels = [
  { key: "diy", title: "DIY", subtitle: "Do it yourself" },
  { key: "agency", title: "Agency", subtitle: "Traditional agency" },
  { key: "leadreacher", title: "LeadReacher", subtitle: "Done-for-you" },
] as const;

function MobileOutreachModelComparison({
  rows,
}: {
  rows: ReadonlyArray<{
    label: string;
    icon: typeof Clock;
    diy: string;
    agency: string;
    leadreacher: string;
  }>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeModel, setActiveModel] = useState<OutreachModelKey>("diy");
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const nextModel: OutreachModelKey = progress < 1 / 3 ? "diy" : progress < 2 / 3 ? "agency" : "leadreacher";
    setActiveModel((current) => (current === nextModel ? current : nextModel));
  });

  const selectedModel = outreachModels.find(({ key }) => key === activeModel) ?? outreachModels[0];
  const featured = activeModel === "leadreacher";

  const selectModel = (key: OutreachModelKey) => {
    setActiveModel(key);
    const track = trackRef.current;
    if (!track) return;

    const index = outreachModels.findIndex((model) => model.key === key);
    const availableScroll = Math.max(0, track.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: track.getBoundingClientRect().top + window.scrollY + availableScroll * (index / 2),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div ref={trackRef} className="relative h-[260vh] md:hidden">
      <div className="sticky top-16 py-3">
        <div className="grid min-h-12 grid-cols-3 overflow-hidden rounded-xl border border-[#dedcea] bg-white shadow-[0_10px_30px_rgba(36,25,80,0.08)]" role="tablist" aria-label="Outreach model comparison">
          {outreachModels.map(({ key, title }) => {
            const selected = key === activeModel;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="mobile-outreach-model-panel"
                onClick={() => selectModel(key)}
                className={cn(
                  "min-h-12 border-r border-[#e8e5ef] px-2 text-xs font-bold uppercase tracking-[0.04em] transition-colors last:border-r-0 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#582df2] motion-reduce:transition-none",
                  selected ? "bg-[#582df2] text-white" : "bg-white text-[#4d5263]",
                )}
              >
                {title}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs font-medium text-[#73778a]">Scroll to compare each approach</p>

        <section
          id="mobile-outreach-model-panel"
          role="tabpanel"
          aria-label={`${selectedModel.title} outreach model`}
          className={cn(
            "mt-3 overflow-hidden rounded-[1.35rem] border bg-white shadow-[0_16px_42px_rgba(36,25,80,0.1)]",
            featured ? "border-[#7b58ff]" : "border-[#dedcea]",
          )}
        >
          <header className={cn("px-5 py-3 text-center", featured ? "bg-[#582df2] text-white" : "border-b border-[#e8e5ef] text-[#171a27]")}>
            <h4 className="text-lg font-bold">{selectedModel.title}</h4>
            <p className={cn("mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em]", featured ? "text-white/75" : "text-[#686d80]")}>{selectedModel.subtitle}</p>
          </header>

          <dl className="divide-y divide-[#e8e5ef]">
            {rows.map(({ label, icon: Icon, diy, agency, leadreacher }, index) => {
              const value = activeModel === "diy" ? diy : activeModel === "agency" ? agency : leadreacher;
              return (
                <div key={label} className={cn("grid min-h-[3.65rem] grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-3 px-4 py-2.5", featured && "bg-[#fbfaff]")}>
                  <dt className="flex items-center gap-2 text-[0.82rem] font-medium text-[#3e4353]">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", featured ? "border-[#ddd4ff] bg-white text-[#5529e8]" : "border-[#e6e3ee] text-[#555a6a]")}>
                      <Icon className="size-4.5" weight="regular" aria-hidden />
                    </span>
                    {label}
                  </dt>
                  <dd className={cn("flex items-center justify-end gap-2 text-right text-[0.82rem] leading-5 text-[#303443]", featured && "font-semibold text-[#4f2de0]", featured && index === rows.length - 1 && "text-base font-bold")}>
                    <span>{value}</span>
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className={cn("border-t px-4 py-3 text-center", featured ? "border-[#d8ceff] bg-[#f7f4ff]" : "border-[#e8e5ef] bg-[#fafafd]")}>
            <p className={cn("text-[0.66rem] font-semibold uppercase tracking-[0.08em]", featured ? "text-[#5b468f]" : "text-[#73778a]")}>
              {featured ? "Less busywork. More conversations." : activeModel === "diy" ? "You own every step." : "You manage the relationship."}
            </p>
          </div>
        </section>

        <div className="mt-4 flex justify-center gap-2" aria-hidden>
          {outreachModels.map(({ key }) => <span key={key} className={cn("h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none", key === activeModel ? "w-8 bg-[#582df2]" : "w-1.5 bg-[#d6d2e2]")} />)}
        </div>
      </div>
    </div>
  );
}

function DataPerformanceSection() {
  const performanceRows = [
    { label: "Cold call", value: "<1%", icon: MessageCircle, featured: false },
    { label: "Cold email", value: "<1%", icon: Mail, featured: false },
    { label: "Standard cold DM", value: "3–5%", icon: MessageSquare, featured: false },
    { label: "Sales-focused DM", value: "8–15%", icon: Target, featured: true },
    { label: "Personalized video DM", value: "15–25%+", icon: Video, featured: true },
  ] as const;

  const modelRows = [
    { label: "Setup", icon: Clock, diy: "Multiple tools", agency: "Lengthy onboarding", leadreacher: "~60 seconds" },
    { label: "Prospecting", icon: Search, diy: "Build lists yourself", agency: "Managed manually", leadreacher: "AI finds ideal prospects" },
    { label: "Content", icon: Pencil, diy: "Create it yourself", agency: "Agency-created", leadreacher: "Personalized automatically" },
    { label: "Outreach", icon: Send, diy: "Manage it yourself", agency: "Agency-managed", leadreacher: "Runs automatically" },
    { label: "Channels", icon: Users, diy: "Manage separately", agency: "Depends on agency", leadreacher: "Targets the right channels" },
    { label: "Price", icon: DollarSign, diy: "Tools + your time", agency: "High monthly cost", leadreacher: "One subscription" },
    { label: "Your job", icon: UserRound, diy: "Do everything", agency: "Manage the agency", leadreacher: "Reply and close" },
  ] as const;

  return (
    <div>
      <div className="grid items-center gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16 xl:gap-20">
        <div className="max-w-[36rem]">
          <div className="flex items-center gap-4 text-[#4f2de0]"><span aria-hidden className="h-px w-9 bg-current" /><p className="text-xs font-bold uppercase tracking-[0.18em] 2xl:text-sm">Why LeadReacher</p><span aria-hidden className="h-px w-9 bg-current" /></div>
          <h2 className="mt-7 text-balance text-[clamp(3.25rem,6vw,6.25rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[#090b15]">Scale faster.<br />The <DataLensWord /><br />doesn&apos;t lie.</h2>
          <p className="mt-7 max-w-[34rem] text-lg leading-8 text-[#5d6274] sm:text-xl sm:leading-9">Optimized for <span className="font-semibold text-[#4f2de0]">maximum conversion</span> to support rapid client acquisition and growth for companies in B2B or B2C.</p>
        </div>

        <div>
          <SpotlightCard spotlightColor="rgba(134, 89, 255, 0.24)" spotlightClassName="mix-blend-screen motion-reduce:transition-none" className="rounded-[1.35rem] border-0 bg-[radial-gradient(circle_at_90%_0%,rgba(91,47,244,0.22),transparent_34%),linear-gradient(145deg,#070b16,#0c1220)] p-6 text-white shadow-[0_24px_70px_rgba(20,16,45,0.22)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_85px_rgba(50,31,115,0.28)] motion-reduce:transform-none motion-reduce:transition-none sm:p-8 lg:p-7 xl:p-9">
            <p className="text-sm font-bold uppercase tracking-[0.06em] text-[#a16dff] sm:text-base">Current outreach performance</p>
            <div className="mt-6 grid grid-cols-[1fr_auto] gap-4 border-b border-white/15 pb-3 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-white/62 sm:text-xs"><span>Channel / method</span><span>Outreach conversion</span></div>
            <div className="divide-y divide-white/14">{performanceRows.map(({ label, value, icon: Icon, featured }) => <div key={label} className={cn("grid min-h-14 grid-cols-[1fr_auto] items-center gap-4 py-3", featured && "text-[#a766ff]")}><span className="flex items-center gap-3 text-base font-medium sm:text-lg"><Icon className="size-6 shrink-0 sm:size-7" weight="regular" />{label}</span><span className={cn("text-lg font-semibold tabular-nums sm:text-xl", featured ? "text-[#a766ff]" : "text-white")}>{value}</span></div>)}</div>
          </SpotlightCard>
          <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-[#666c7e]"><span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">i</span>Conversion = positive sales conversation. Results vary by market.</p>
        </div>
      </div>

      <div className="mt-14 sm:mt-20">
        <div className="mb-5 flex items-center gap-4 text-[#4f2de0]"><span aria-hidden className="h-1 w-16 rounded-full bg-current" /><h3 className="text-xs font-bold uppercase tracking-[0.16em] sm:text-sm">Current outreach model comparison</h3></div>
        <MobileOutreachModelComparison rows={modelRows} />
        <SpotlightCard spotlightColor="rgba(91, 47, 244, 0.13)" spotlightClassName="z-[1] mix-blend-multiply motion-reduce:transition-none" className="hidden rounded-2xl border border-[#dedcea] shadow-[0_18px_50px_rgba(36,25,80,0.08)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[#c9c0f5] hover:shadow-[0_24px_65px_rgba(62,39,137,0.13)] motion-reduce:transform-none motion-reduce:transition-none md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm text-[#171a27] lg:text-base">
              <thead><tr className="border-b border-[#dfddea]"><th scope="col" className="w-[21%] px-5 py-5 sm:px-7"><span className="sr-only">Category</span></th><th scope="col" className="w-[25%] border-l border-[#e8e5ef] px-5 py-4 text-center sm:px-7"><span className="block text-lg font-semibold">DIY</span><span className="block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[#686d80]">Do it yourself</span></th><th scope="col" className="w-[25%] border-l border-[#e8e5ef] px-5 py-4 text-center sm:px-7"><span className="block text-lg font-semibold">Agency</span><span className="block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[#686d80]">Traditional agency</span></th><th scope="col" className="w-[29%] border-l border-[#dcd4ff] bg-[#f7f4ff] px-5 py-4 text-center text-[#4f2de0] sm:px-7"><span className="block text-lg font-bold">LeadReacher</span><span className="block text-[0.65rem] font-semibold uppercase tracking-[0.06em]">Done-for-you</span></th></tr></thead>
              <tbody>{modelRows.map(({ label, icon: Icon, diy, agency, leadreacher }, index) => <tr key={label} className={cn(index !== modelRows.length - 1 && "border-b border-[#e8e5ef]")}><th scope="row" className="px-5 py-4 font-medium sm:px-7"><span className="flex items-center gap-3"><Icon className="size-5 shrink-0 text-[#151824]" weight="regular" />{label}</span></th><td className="border-l border-[#e8e5ef] px-5 py-4 text-center sm:px-7">{diy}</td><td className="border-l border-[#e8e5ef] px-5 py-4 text-center sm:px-7">{agency}</td><td className="border-l border-[#dcd4ff] bg-[#f7f4ff] px-5 py-4 font-semibold text-[#4f2de0] sm:px-7"><span className="flex items-center gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#582df2] text-white"><Check className="size-3.5" weight="bold" /></span><span className={cn(index === modelRows.length - 1 && "text-xl font-bold sm:text-2xl")}>{leadreacher}</span></span></td></tr>)}</tbody>
            </table>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

function DifferentiationSection() {
  const reducedMotion = useReducedMotion();
  const orbitRef = useRef<HTMLUListElement>(null);
  const orbitItemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const mapSpotlightRef = useRef<SVGCircleElement>(null);
  const mapShineRef = useRef<SVGPathElement>(null);
  const mapFrameRef = useRef(0);
  const mapBoundsRef = useRef<DOMRect | null>(null);
  const mapPointerRef = useRef({ x: 600, y: 260 });
  const [orbitSize, setOrbitSize] = useState({ width: 0, height: 0 });
  const orbitChannels = useMemo(() => [
    { label: "LinkedIn", ring: 0, phase: 0.04, mark: <ChannelLogo name="linkedin" className="size-8 sm:size-11" /> },
    { label: "WhatsApp", ring: 0, phase: 0.24, mark: <ChannelLogo name="whatsapp-mark" className="size-9 sm:size-12" /> },
    { label: "YouTube", ring: 0, phase: 0.44, mark: <SocialMediaIcon name="youtube" className="size-8 text-[#ff0000] sm:size-11" /> },
    { label: "Instagram", ring: 0, phase: 0.64, mark: <ChannelLogo name="instagram" className="size-8 sm:size-11" /> },
    { label: "Gmail", ring: 0, phase: 0.84, mark: <ChannelLogo name="gmail" className="size-8 sm:size-11" /> },
    { label: "Telegram", ring: 1, phase: 0.1, mark: <SocialMediaIcon name="telegram" className="size-8 text-[#229ed9] sm:size-11" /> },
    { label: "Facebook", ring: 1, phase: 0.3, mark: <ChannelLogo name="facebook" className="size-8 sm:size-11" /> },
    { label: "Outlook", ring: 1, phase: 0.5, mark: <ChannelLogo name="outlook" className="size-8 sm:size-11" /> },
    { label: "X", ring: 1, phase: 0.7, mark: <SocialMediaIcon name="x" className="size-7 text-black sm:size-9" /> },
    { label: "TikTok", ring: 1, phase: 0.9, mark: <SocialMediaIcon name="tiktok" className="size-7 text-black sm:size-10" /> },
  ] as const, []);
  const orbitChannelCount = orbitChannels.length;

  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    const updateSize = () => setOrbitSize({ width: orbit.clientWidth, height: orbit.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(orbit);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!orbitSize.width || !orbitSize.height) return;

    const rings = [
      { radiusX: 0.27, radiusY: 0.26, duration: 42_000, direction: 1 },
      { radiusX: 0.47, radiusY: 0.37, duration: 78_000, direction: -1 },
    ] as const;
    const orbitElements = orbitItemRefs.current.slice();
    const animations = orbitElements.flatMap((element, index) => {
      if (!element) return [];

      const channel = orbitChannels[index];
      const ring = rings[channel.ring];
      const radiusX = orbitSize.width * ring.radiusX;
      const radiusY = orbitSize.height * ring.radiusY;
      const phase = channel.phase * Math.PI * 2;
      const frameCount = 64;
      const frames = Array.from({ length: frameCount + 1 }, (_, frameIndex) => {
        const angle = phase + ring.direction * (frameIndex / frameCount) * Math.PI * 2;
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;
        const depth = (Math.sin(angle) + 1) / 2;
        const scale = 0.78 + depth * 0.28;
        return {
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        };
      });

      element.style.transform = frames[0].transform;
      if (reducedMotion) return [];

      element.style.willChange = "transform";
      return [element.animate(frames, {
        duration: ring.duration,
        easing: "linear",
        iterations: Number.POSITIVE_INFINITY,
      })];
    });

    let isOrbitVisible = false;
    let velocityFrame = 0;
    let previousScrollY = window.scrollY;
    let previousFrameTime = performance.now();
    let smoothedScrollVelocity = 0;

    const stopVelocityTracking = () => {
      if (velocityFrame) window.cancelAnimationFrame(velocityFrame);
      velocityFrame = 0;
    };

    const updateOrbitSpeed = (frameTime: number) => {
      const elapsedSeconds = Math.max((frameTime - previousFrameTime) / 1_000, 0.001);
      const scrollY = window.scrollY;
      const targetVelocity = (scrollY - previousScrollY) / elapsedSeconds;
      const smoothing = Math.min(1, 12 * elapsedSeconds);
      smoothedScrollVelocity += (targetVelocity - smoothedScrollVelocity) * smoothing;

      const boundedVelocity = Math.min(Math.abs(smoothedScrollVelocity), 2_400);
      const playbackRate = Math.min(8, 1 + boundedVelocity * 0.0035);
      animations.forEach((animation) => {
        animation.playbackRate = playbackRate;
      });

      previousScrollY = scrollY;
      previousFrameTime = frameTime;
      velocityFrame = window.requestAnimationFrame(updateOrbitSpeed);
    };

    const startVelocityTracking = () => {
      if (velocityFrame || reducedMotion) return;
      previousScrollY = window.scrollY;
      previousFrameTime = performance.now();
      velocityFrame = window.requestAnimationFrame(updateOrbitSpeed);
    };

    const setPlayback = () => {
      const shouldPlay = isOrbitVisible && document.visibilityState === "visible";
      animations.forEach((animation) => shouldPlay ? animation.play() : animation.pause());
      if (shouldPlay) {
        startVelocityTracking();
      } else {
        stopVelocityTracking();
      }
    };
    animations.forEach((animation) => animation.pause());
    const observer = new IntersectionObserver(([entry]) => {
      isOrbitVisible = entry.isIntersecting;
      setPlayback();
    }, { rootMargin: "180px 0px" });
    const orbit = orbitRef.current;
    if (orbit) observer.observe(orbit);
    document.addEventListener("visibilitychange", setPlayback);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", setPlayback);
      stopVelocityTracking();
      animations.forEach((animation) => animation.cancel());
      orbitElements.forEach((element) => {
        if (element) element.style.willChange = "";
      });
    };
  }, [orbitChannelCount, orbitChannels, orbitSize.height, orbitSize.width, reducedMotion]);

  const updateMapSpotlight = (event: MouseEvent<HTMLDivElement>) => {
    const spotlight = mapSpotlightRef.current;
    const shine = mapShineRef.current;
    if (!spotlight || !shine) return;

    const bounds = mapBoundsRef.current ?? event.currentTarget.getBoundingClientRect();
    mapBoundsRef.current = bounds;
    mapPointerRef.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * 1200,
      y: ((event.clientY - bounds.top) / bounds.height) * 500,
    };
    if (mapFrameRef.current) return;
    mapFrameRef.current = window.requestAnimationFrame(() => {
      mapFrameRef.current = 0;
      spotlight.setAttribute("cx", String(mapPointerRef.current.x));
      spotlight.setAttribute("cy", String(mapPointerRef.current.y));
      shine.style.opacity = "1";
    });
  };

  const hideMapSpotlight = () => {
    mapBoundsRef.current = null;
    if (mapFrameRef.current) window.cancelAnimationFrame(mapFrameRef.current);
    mapFrameRef.current = 0;
    if (mapShineRef.current) mapShineRef.current.style.opacity = "0";
  };

  useEffect(() => () => {
    if (mapFrameRef.current) window.cancelAnimationFrame(mapFrameRef.current);
  }, []);

  return (
    <EdgeSurface data-navbar-theme="light" className="relative z-10 -mt-7 overflow-clip py-16 sm:-mt-9 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 min-[360px]:px-5 sm:px-8 lg:px-10 large-desktop:max-w-[88rem] large-desktop:px-12">
        <DataPerformanceSection />

        <div className="relative left-1/2 mt-20 h-24 w-screen -translate-x-1/2 sm:mt-28 sm:h-32 lg:h-40">
          <HeroBreak />
        </div>

        <div className="pt-8 text-center sm:pt-10">
          <div className="flex items-center justify-center gap-4 text-[#5332db]">
            <span aria-hidden className="h-px w-8 bg-current sm:w-11" />
            <ShieldCheck className="size-6 sm:size-7" weight="regular" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.17em] sm:text-sm lg:text-base">Officially approved APIs</p>
            <span aria-hidden className="h-px w-8 bg-current sm:w-11" />
          </div>
          <h2 className="mx-auto mt-7 max-w-[76rem] text-[clamp(2.65rem,5.7vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[#080b1d]">
            <span className="block lg:whitespace-nowrap">Every channel. Every market.</span>
            <span className="block">One <ShimmerText
              className="whitespace-nowrap"
              style={{
                "--lr-shimmer-base": "#5a2ff4",
                "--lr-shimmer-core": "#58a6ff",
                "--lr-shimmer-edge": "rgba(125, 183, 255, 0.72)",
              } as CSSProperties}
            >outreach engine.</ShimmerText></span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-balance text-lg font-medium leading-7 text-[#66697a] sm:text-xl sm:leading-8 lg:text-2xl lg:leading-9">
            Reach prospects <span className="font-semibold text-[#4f2de0]">anywhere in the world</span>, in <span className="font-semibold text-[#4f2de0]">any language</span>,<br className="hidden sm:block" /> across the channels they already use.
          </p>
        </div>

        <div
          className="relative mx-auto mt-4 h-[330px] max-w-[78rem] sm:mt-6 sm:h-[430px] lg:h-[500px]"
          onMouseEnter={(event) => { mapBoundsRef.current = event.currentTarget.getBoundingClientRect(); }}
          onMouseMove={updateMapSpotlight}
          onMouseLeave={hideMapSpotlight}
        >
          <svg aria-hidden viewBox="0 0 1200 500" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <defs>
              <pattern id="api-map-dots" width="7" height="7" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.15" fill="#6652dd" opacity="0.24" />
              </pattern>
              <pattern id="api-map-dots-bright" width="7" height="7" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.55" fill="#6847f4" opacity="0.9" />
              </pattern>
              <linearGradient id="api-orbit-gradient" x1="0" x2="1">
                <stop stopColor="#806cf1" stopOpacity="0.12" />
                <stop offset="0.5" stopColor="#6041df" stopOpacity="0.42" />
                <stop offset="1" stopColor="#806cf1" stopOpacity="0.12" />
              </linearGradient>
              <filter id="api-dot-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="api-map-cursor-falloff">
                <stop offset="0" stopColor="white" />
                <stop offset="0.45" stopColor="white" stopOpacity="0.92" />
                <stop offset="1" stopColor="black" />
              </radialGradient>
              <mask id="api-map-cursor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="500">
                <rect width="1200" height="500" fill="black" />
                <circle ref={mapSpotlightRef} cx="600" cy="260" r="105" fill="url(#api-map-cursor-falloff)" />
              </mask>
            </defs>
            <path
              d={APPROVED_API_WORLD_MAP_PATH}
              fill="url(#api-map-dots)"
            />
            <path
              ref={mapShineRef}
              d={APPROVED_API_WORLD_MAP_PATH}
              fill="url(#api-map-dots-bright)"
              mask="url(#api-map-cursor-mask)"
              className="pointer-events-none opacity-0 transition-opacity duration-200 motion-reduce:transition-none"
            />
            <ellipse cx="600" cy="260" rx="564" ry="185" fill="none" stroke="url(#api-orbit-gradient)" strokeWidth="1.5" />
            <ellipse cx="600" cy="260" rx="324" ry="130" fill="none" stroke="#6b51e7" strokeOpacity="0.2" strokeWidth="1.1" />
            {[
              { radiusX: 555, radiusY: 175, angle: Math.PI },
              { radiusX: 555, radiusY: 175, angle: 2.22 },
              { radiusX: 324, radiusY: 130, angle: 4.25 },
              { radiusX: 324, radiusY: 130, angle: 1.07 },
              { radiusX: 555, radiusY: 175, angle: 5.62 },
              { radiusX: 555, radiusY: 175, angle: 0.3 },
            ].map(({ radiusX, radiusY, angle }, index) => (
              <circle
                key={`${radiusX}-${angle}`}
                cx={600 + Math.cos(angle) * radiusX}
                cy={260 + Math.sin(angle) * radiusY}
                r="3.5"
                fill="#6847e8"
                filter="url(#api-dot-glow)"
                data-orbit-marker={index}
              />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-20 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white shadow-[0_12px_32px_rgba(68,43,175,0.22),0_0_0_13px_rgba(255,255,255,.78),0_0_0_23px_rgba(111,76,255,.07)] sm:size-40 lg:size-44">
            <Image src="/logo/leadreacher_plane_only.svg" width={92} height={92} alt="" className="size-12 object-contain sm:size-16 lg:size-[4.5rem]" />
            <span className="mt-1 text-sm font-semibold tracking-[-0.03em] text-[#111527] sm:text-lg">leadreacher</span>
          </div>

          <ul ref={orbitRef} aria-label="Supported outreach channels" className="pointer-events-none absolute inset-0 z-30">
            {orbitChannels.map(({ label, mark, ring }, index) => {
              return (
                <li
                  key={label}
                  ref={(element) => { orbitItemRefs.current[index] = element; }}
                  data-ring={ring}
                  className="absolute left-1/2 top-1/2 -ml-6 -mt-6 sm:-ml-9 sm:-mt-9"
                >
                  <span className="pointer-events-auto relative flex size-12 items-center justify-center transition-[transform,filter] duration-300 hover:scale-[1.15] hover:drop-shadow-[0_8px_12px_rgba(77,51,179,0.32)] motion-reduce:transition-none sm:size-[4.5rem]">
                    {mark}<span className="sr-only">{label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-auto mt-12 grid max-w-[72rem] gap-8 border-y border-[#e8e4f2] py-8 sm:mt-16 sm:grid-cols-3 sm:gap-0 sm:py-9">
          {[
            { icon: ShieldCheck, title: "Approved API", lines: <>with all major social channels</>, description: <>Secure, reliable connections to the platforms you use.</> },
            { icon: Globe, title: "Any language & market", lines: null, description: <>Localized for every prospect.<br />Anywhere in the world.</> },
            { icon: Zap, title: "Fully automated", lines: null, description: <>We handle the outreach.<br />You close deals.</> },
          ].map(({ icon: Icon, title, lines, description }, index) => (
            <div key={title} className={cn("flex items-start gap-4 px-2 text-left sm:px-7 lg:px-10", index > 0 && "sm:border-l sm:border-[#ddd9e8]")}>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f5f1ff] text-[#5a32ed] sm:size-16">
                <Icon className="size-8 sm:size-9" weight="regular" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold leading-5 text-[#121523] sm:text-lg">{title}{lines ? <><br />{lines}</> : null}</h3>
                <p className="mt-2 text-sm leading-6 text-[#686d7f] sm:text-base">{description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </EdgeSurface>
  );
}

function CampaignExpansionSection() {
  const videoTargetRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollExpandMedia
      mediaSrc="/landing/product-story/personalized-video-outreach.mp4"
      mediaAlt="Personalized video outreach prepared for a prospect"
      mediaType="video"
      posterSrc="/landing/product-story/personalized-video-outreach-poster.webp"
      eyebrow="Personalized video outreach"
      title={<>The first to feature one‑of‑a‑kind personalized video outreach for <MarkerHighlight>each prospect.</MarkerHighlight></>}
      description={<AnimatedHighlightText as="p" className="pointer-events-auto !max-w-none !text-inherit !text-base !leading-inherit sm:!text-base lg:!text-lg">Don&apos;t worry, you <a href="#approval-review" onClick={scrollToApproval} className="rounded-sm text-inherit outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#b6a6ff]"><Highlight tabIndex={-1} icon={<SparklesIcon />} color="#b6a6ff"><BubbleText>approve all outgoing content</BubbleText></Highlight></a> before it reaches your customer.</AnimatedHighlightText>}
      magicMoveTargetRef={videoTargetRef}
    >
      <div className="mx-auto max-w-7xl large-desktop:max-w-[88rem]">
        <div id="approval-review" className="scroll-mt-24 grid items-center gap-10 lg:grid-cols-[0.72fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase text-[#ae9bff] large-desktop:text-sm">Personalized video outreach</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight text-white large-desktop:text-[2.75rem]">
              Every prospect gets a video <MarkerHighlight>built for them.</MarkerHighlight>
            </h2>
            <p className="mt-5 text-base leading-7 text-white/64 large-desktop:text-lg large-desktop:leading-8">LeadReacher pairs each prospect with a tailored message and video, using their company context to make every introduction feel relevant.</p>
            <FeatureList
              items={[
                { icon: UserCheck, label: "Personalized around the prospect" },
                { icon: FilePenLine, label: "Message and video work together" },
                { icon: Video, label: "Review every video before launch" },
              ]}
              className="mt-7 space-y-4 text-sm font-medium text-white/82 large-desktop:text-base"
              itemClassName="flex items-center gap-3"
              iconWrapperClassName="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#6842f5] text-white ring-1 ring-white/15"
              iconClassName="size-3.5"
            />
          </div>
          <div className="w-full max-w-[42rem] justify-self-center">
            <ApprovalPreview
              videoTargetRef={videoTargetRef}
              videoSrc="/landing/product-story/personalized-video-outreach.mp4"
              videoPoster="/landing/product-story/personalized-video-outreach-poster.webp"
            />
          </div>
        </div>
      </div>
    </ScrollExpandMedia>
  );
}

function PricingTrustShowcase() {
  const reducedMotion = Boolean(useReducedMotion());
  const handlePricingPointerMove = (event: MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pricing-pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--pricing-pointer-y", `${event.clientY - bounds.top}px`);
  };

  const resetPricingPointer = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--pricing-pointer-x", "50%");
    event.currentTarget.style.setProperty("--pricing-pointer-y", "35%");
  };

  return (
    <section id="resources" aria-labelledby="pricing-trust-heading" className="relative mt-20 scroll-mt-24 py-4 sm:mt-24 sm:py-8">
      <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-14 xl:gap-20">
        <div className="max-w-3xl">
          <m.p
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.35 }}
            className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4e28df]"
          >
            Outreach without the risk
          </m.p>

          <h2
            id="pricing-trust-heading"
            className="mt-8 text-balance text-[2.55rem] font-semibold leading-[0.96] tracking-[-0.055em] text-[#101426] sm:mt-14 sm:text-6xl lg:text-[clamp(3rem,5vw,5.5rem)]"
          >
            <span className="block">
              No{" "}
              <span className="relative inline-block text-[#101426]">
                spam.
                <span
                  aria-hidden
                  className="landing-risk-strike pointer-events-none absolute left-[-2%] top-[52%] z-10 h-[5px] w-[104%] origin-left -rotate-2 rounded-full bg-[#ff625c] sm:h-[6px]"
                />
              </span>
            </span>
            <span className="mt-2 block sm:whitespace-nowrap">
              No{" "}
              <span className="relative inline-block whitespace-nowrap text-[#101426]">
                ninja billing.
                <span
                  aria-hidden
                  className="landing-risk-strike landing-risk-strike--delayed pointer-events-none absolute left-[-1%] top-[52%] z-10 h-[5px] w-[102%] origin-left -rotate-1 rounded-full bg-[#ff625c] sm:h-[6px]"
                />
              </span>
            </span>
          </h2>

          <p className="mt-8 max-w-xl text-xl leading-8 text-[#5e6377] sm:text-2xl sm:leading-9">
            Responsible outreach.<br />
            Transparent billing.<br />
            No surprises.
          </p>

          <div className="mt-10 grid gap-7 border-t border-[#e3def2] pt-8 sm:grid-cols-2 sm:gap-8">
            <div className="group flex items-start gap-4">
              <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#f1edff] text-[#5428e4] ring-1 ring-[#d9d0ff] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none">
                <ShieldCheck className="size-8" aria-hidden />
                <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#36ad68] text-white"><Check className="size-3.5" aria-hidden /></span>
              </span>
              <div className="pt-1">
                <h3 className="text-base font-semibold text-[#111527]">No Spam Guarantee</h3>
                <p className="mt-2 max-w-[17rem] text-sm leading-6 text-[#62697e]">Platform-safe, controlled outreach that stays reviewable.</p>
              </div>
            </div>
            <div className="group flex items-start gap-4">
              <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#f1edff] text-[#5428e4] ring-1 ring-[#d9d0ff] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none">
                <CreditCard className="size-8" aria-hidden />
                <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#36ad68] text-white"><Check className="size-3.5" aria-hidden /></span>
              </span>
              <div className="pt-1">
                <h3 className="text-base font-semibold text-[#111527]">No Ninja Billing</h3>
                <p className="mt-2 max-w-[17rem] text-sm leading-6 text-[#62697e]">Know your final total before you are charged.</p>
              </div>
            </div>
          </div>
        </div>

        <m.aside
          aria-label="LeadReacher Pro pricing"
          onMouseMove={handlePricingPointerMove}
          onMouseLeave={resetPricingPointer}
          initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          whileHover={reducedMotion ? undefined : { y: -5 }}
          style={{ "--pricing-pointer-x": "50%", "--pricing-pointer-y": "35%" } as CSSProperties}
          className="group relative isolate mx-auto w-full max-w-[35rem] overflow-hidden rounded-[30px] border border-white/10 bg-[#0c1020] p-7 text-white shadow-[0_32px_70px_rgba(43,27,105,.28),0_12px_26px_rgba(96,56,243,.18)] sm:p-10 lg:min-h-[39rem] lg:p-11"
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(360px_circle_at_var(--pricing-pointer-x)_var(--pricing-pointer-y),rgba(126,91,255,.28),rgba(78,40,223,.10)_38%,transparent_70%)]" />
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[#6538f2]/20 blur-[72px]" />
          <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-[#4222b6]/18 blur-[80px]" />
          <div className="relative flex h-full min-h-[31rem] flex-col text-center lg:min-h-[33rem]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9c86ff]">Simple pricing</p>
            <span aria-hidden className="mx-auto mt-5 block h-0.5 w-16 rounded-full bg-[#6842f5]" />
            <p className="mt-10 text-xl font-semibold text-white">LeadReacher Pro</p>
            <div className="mt-7 flex items-start justify-center text-white" aria-label="$199.99 per month">
              <span aria-hidden className="mt-2 text-4xl font-semibold text-[#7249ff]">$</span>
              <span aria-hidden className="text-[clamp(6.5rem,11vw,10rem)] font-semibold leading-[0.78] tracking-[-0.075em]">199</span>
              <span aria-hidden className="ml-2 mt-1 text-4xl font-semibold leading-none tracking-[-0.04em] text-[#7249ff] sm:ml-3 sm:mt-0">.99</span>
            </div>
            <p className="mt-7 text-2xl font-semibold text-[#805fff]">/ month</p>

            <div className="mt-9 border-t border-white/12 pt-8">
              <p className="text-base leading-7 text-white/68">One plan for your complete outreach workflow.</p>
              <p className="mt-2 text-sm text-white/48">Billed monthly. Cancel anytime.</p>
            </div>

            <div className="mt-auto pt-9">
              <Link
                href="/pricing"
                className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(100deg,#5425ea,#6b35f5_58%,#5c2be8)] px-5 text-base font-semibold text-white shadow-[0_16px_30px_rgba(82,37,234,.28)] transition-[transform,box-shadow,filter] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_20px_38px_rgba(82,37,234,.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad9cff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1020] motion-reduce:transform-none"
              >
                View pricing <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden />
              </Link>
              <p className="mt-5 flex items-center justify-center gap-2 text-xs leading-5 text-white/52">
                <ShieldCheck className="size-4 text-[#9c86ff]" aria-hidden />
                Final total confirmed before purchase.
              </p>
            </div>
          </div>
        </m.aside>
      </div>
    </section>
  );
}

function PricingAndFaqSection() {
  const reducedMotion = Boolean(useReducedMotion());
  const reviewStoryRef = useRef<HTMLDivElement>(null);
  const lastReviewScrollYRef = useRef<number | null>(null);
  const reviewScrollFrameRef = useRef<number | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const { scrollYProgress: reviewScrollProgress } = useScroll({
    target: reviewStoryRef,
    offset: ["start start", "end end"],
  });
  const activeCheckoutState = checkoutStates[activeReviewIndex];

  useEffect(() => {
    const unsubscribe = reviewScrollProgress.on("change", (progress) => {
      const currentScrollY = window.scrollY;
      const previousScrollY = lastReviewScrollYRef.current;
      lastReviewScrollYRef.current = currentScrollY;

      if (previousScrollY === null || Math.abs(currentScrollY - previousScrollY) < 1) return;

      const nextIndex = Math.min(reviewCards.length - 1, Math.floor(progress * reviewCards.length));
      if (reviewScrollFrameRef.current !== null) window.cancelAnimationFrame(reviewScrollFrameRef.current);

      reviewScrollFrameRef.current = window.requestAnimationFrame(() => {
        reviewScrollFrameRef.current = null;
        setActiveReviewIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
      });
    });

    return () => {
      unsubscribe();
      if (reviewScrollFrameRef.current !== null) window.cancelAnimationFrame(reviewScrollFrameRef.current);
    };
  }, [reviewScrollProgress]);

  return (
    <EdgeSurface as="section" id="pricing" data-navbar-theme="light" className="relative z-40 -mt-7 overflow-visible scroll-mt-20 rounded-[28px] py-16 sm:-mt-9 sm:rounded-[40px] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 min-[360px]:px-5 sm:px-8 lg:px-10 large-desktop:max-w-[88rem] large-desktop:px-12">
        <div ref={reviewStoryRef} data-review-story className="relative mt-20 min-h-[220svh] sm:mt-24 lg:min-h-[220vh]">
          <div className="sticky top-20 grid min-h-[calc(100svh-5rem)] items-center gap-10 py-5 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[.9fr_1.1fr] lg:gap-14 lg:py-10">
            <div className="px-1 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase text-[#5b39d5] 2xl:text-sm">Built for review, not guesswork</p>
              <h2 className="mt-4 text-3xl font-semibold text-[#111527] 2xl:text-4xl">The work stays visible as it moves.</h2>
              <p className="mt-4 hidden max-w-xl text-base leading-7 text-[#62697e] sm:block 2xl:text-lg 2xl:leading-8">Each stage has an explicit review point, a clear status, and a direct path into the next action.</p>
              <MorphingCardStack cards={reviewCards} activeIndex={activeReviewIndex} onActiveChange={setActiveReviewIndex} className="mt-7" />
            </div>
            <div className="relative hidden min-h-[647px] rounded-lg bg-[#101322] p-9 text-white shadow-[0_30px_80px_rgba(26,19,65,0.2)] lg:block">
              <m.div
                key={activeReviewIndex}
                initial={reducedMotion ? false : { opacity: 0.72, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full flex-col"
              >
                  <p className="text-xs font-semibold uppercase text-[#9d86ff]">{activeCheckoutState.eyebrow}</p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-y border-white/10 py-3">
                    <div className="flex items-center gap-3">
                      <Image src="/landing/portraits/prospect-68.webp" alt="Sarah" width={36} height={36} sizes="36px" className="size-9 rounded-full border border-white/20 object-cover" />
                      <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">Prepared for</p><p className="mt-0.5 text-sm font-semibold text-white">Sarah · Common Thread</p></div>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#8e79ff]/35 bg-[#6240f5]/15 px-2.5 py-1 text-[10px] font-semibold text-[#c0b5ff]">{activeCheckoutState.status}</span>
                  </div>
                  <h3 className="mt-4 max-w-md text-3xl font-semibold">{activeCheckoutState.title}</h3>
                  <p className="mt-4 min-h-[3rem] text-sm leading-6 text-white/62">{activeCheckoutState.description}</p>
                  <ul className="mt-7 divide-y divide-white/10">
                    {activeCheckoutState.features.map((item) => <li key={item} className="flex items-center gap-3 py-3 text-sm"><span className="flex size-5 items-center justify-center rounded-full bg-[#6240f5]"><Check className="size-3" /></span>{item}</li>)}
                  </ul>
                  <div className="mt-auto pt-8">
                    <Link href="/signup" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#5a32ed] font-semibold transition-colors hover:bg-[#6842f5]">{activeCheckoutState.action} <ArrowRight className="size-4" /></Link>
                    <p className="mt-4 text-center text-xs text-white/50">{activeCheckoutState.note}</p>
                  </div>
              </m.div>
            </div>
          </div>
        </div>
        <PricingTrustShowcase />
        <section
          aria-labelledby="testimonials-heading"
          className="mt-20 sm:mt-24 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-12"
        >
          <div className="mx-auto max-w-xl px-1 py-4 sm:px-6 lg:mx-0 lg:py-0">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5b39d5]">
              Testimonials
            </p>
            <h2
              id="testimonials-heading"
              className="mt-5 text-balance text-4xl font-semibold leading-[1.04] text-[#111527] sm:text-5xl lg:text-[3.75rem]"
            >
              <span className="whitespace-nowrap">Credibility is</span>{" "}
              <br aria-hidden="true" />
              <span className="whitespace-nowrap">
                <PointerHighlight
                  inline
                  indicator="plane"
                  variant="marker"
                  containerClassName="px-1"
                  pointerClassName="text-[#6842f5]"
                >
                  our foundation.
                </PointerHighlight>
              </span>
            </h2>
            <p className="mt-7 text-pretty text-lg leading-8 text-[#62697e] lg:text-xl lg:leading-9">
              See why sales and marketing teams continue to trust LeadReacher to build stronger pipelines and open new market channels.
            </p>
          </div>
          <DeferredTestimonials
            testimonials={testimonialPreviews}
            className="mt-8 lg:mt-0"
          />
        </section>
        <div className="mt-24 sm:mt-28">
          <FaqSectionCentered
            items={faqs}
            eyebrow=""
            heading="Know what happens before you start."
            description="Clear answers about setup, channels, review, personalization, and campaign control."
            supportEmail={SUPPORT_EMAIL}
          />
        </div>
      </div>
    </EdgeSurface>
  );
}

function FooterBrowserBar() {
  const [websiteUrl, setWebsiteUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = websiteUrl.trim();
    const heroInput = document.getElementById("landing-website-url") as HTMLInputElement | null;
    if (heroInput && value) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(heroInput, value);
      heroInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const target = document.getElementById("top");
    if (target) target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    window.setTimeout(() => heroInput?.focus(), 450);
  }

  return (
    <div className="lg:justify-self-end">
      <BrowserBar
        id="footer-website-url"
        value={websiteUrl}
        onValueChange={setWebsiteUrl}
        onSubmit={handleSubmit}
        formClassName="w-full max-w-[calc(100vw-2rem)] sm:w-[34rem] lg:w-[36rem]"
        spotlight
      />
      <p className="mt-3 text-center text-xs text-white/50">No credit card required</p>
    </div>
  );
}

export function FinalCtaAndFooter({ navbarDark }: { navbarDark: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <footer data-navbar-theme={navbarDark ? "dark" : undefined} className="relative z-30 mt-0 overflow-hidden bg-[linear-gradient(180deg,#0b0d19_0%,#080a14_100%)] px-4 pb-[max(2rem,var(--safe-area-bottom))] pt-20 text-white min-[360px]:px-5 sm:px-8 sm:pb-10 sm:pt-28 md:pt-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(93,64,224,.14),transparent_62%)]" />
      <m.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.1 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <section className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#111427] px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:px-10 sm:py-12 lg:px-14 large-desktop:max-w-[88rem] large-desktop:px-16 large-desktop:py-14">
          <div className="relative grid items-center gap-9 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm"><Sparkles className="size-4" /> Start with your website</div>
              <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl 2xl:text-6xl large-desktop:max-w-4xl large-desktop:text-[4.125rem]">Drop your URL. We’ll take it from there.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">See how LeadReacher turns your business into a reviewable audience, campaign, and outreach workflow.</p>
            </div>
            <FooterBrowserBar />
          </div>
          <div className="relative mt-10 grid gap-3 border-t border-white/10 pt-6 text-xs text-white/62 sm:grid-cols-3 sm:gap-6">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#a994ff]" /> Your campaign stays reviewable</span>
            <span className="flex items-center gap-2"><Eye className="size-4 text-[#a994ff]" /> Approve before anything launches</span>
            <span className="flex items-center gap-2"><Pause className="size-4 text-[#a994ff]" /> Pause campaign delivery anytime</span>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-12 px-1 pb-4 pt-14 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-16 large-desktop:max-w-[88rem] large-desktop:pt-16">
          <div>
            <Logo variant="white" align="left" className="h-8" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/62">Multi-channel outreach and personalized video in one clear, reviewable workflow.</p>
            <a href={SUPPORT_MAILTO} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/78 transition-colors hover:text-white"><Mail className="size-4 text-[#a994ff]" /> {SUPPORT_EMAIL}</a>
          </div>
          <nav aria-label="Product links"><p className="text-sm font-semibold text-white">Product</p><div className="mt-3 text-sm text-white/58"><Link href="/#product" className="flex min-h-11 items-center transition-colors hover:text-white">Product tour</Link><Link href="/#how-it-works" className="flex min-h-11 items-center transition-colors hover:text-white">How it works</Link><Link href="/pricing" className="flex min-h-11 items-center transition-colors hover:text-white">Pricing</Link></div></nav>
          <nav aria-label="Resource links"><p className="text-sm font-semibold text-white">Resources</p><div className="mt-3 text-sm text-white/58"><a href={SUPPORT_MAILTO} className="flex min-h-11 items-center transition-colors hover:text-white">Help center</a><Link href="/privacy" className="flex min-h-11 items-center transition-colors hover:text-white">Privacy</Link><Link href="/terms" className="flex min-h-11 items-center transition-colors hover:text-white">Terms</Link></div></nav>
          <nav aria-label="Account links"><p className="text-sm font-semibold text-white">Account</p><div className="mt-3 text-sm text-white/58"><Link href="/signup" className="flex min-h-11 items-center transition-colors hover:text-white">Get started</Link><Link href="/login" className="flex min-h-11 items-center transition-colors hover:text-white">Log in</Link></div></nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-1 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between large-desktop:max-w-[88rem]"><p>© 2026 LeadReacher. All rights reserved.</p><p>Built for visible, reviewable outreach.</p></div>
      </m.div>
    </footer>
  );
}

function FooterReveal() {
  return (
    <div className="relative z-30 isolate bg-[#111318]">
      <div className="relative z-10 bg-[#111318]">
        <PricingAndFaqSection />
      </div>
      <div className="sticky bottom-0 z-0">
        <FinalCtaAndFooter navbarDark />
      </div>
    </div>
  );
}

export default function LandingSections() {
  return <><DifferentiationSection /><CampaignExpansionSection /><FooterReveal /></>;
}
