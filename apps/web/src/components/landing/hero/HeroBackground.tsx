import { FiberFlowBackground } from "@/components/ui/fiber-flow-background";

export default function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#f7f6ff]" aria-hidden>
      <FiberFlowBackground className="opacity-100 motion-reduce:opacity-80" speed={0.75} particleCount={70} />
      <div className="hero-ambient-gradient absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.34),transparent_46%)]" />
    </div>
  );
}
