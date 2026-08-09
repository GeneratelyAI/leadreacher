import { FiberFlowBackground } from "@/components/ui/fiber-flow-background";

export default function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white" aria-hidden>
      <FiberFlowBackground backgroundFill="#ffffff" className="opacity-100 motion-reduce:opacity-80" speed={0.75} particleCount={70} />
    </div>
  );
}
