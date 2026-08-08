"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type FiberFlowBackgroundProps = HTMLAttributes<HTMLDivElement> & {
  backgroundFill?: string;
  density?: number;
  particleCount?: number;
  speed?: number;
  targetSelector?: string;
};

type Fiber = {
  spread: number;
  phase: number;
  width: number;
  alpha: number;
  hue: number;
  drift: number;
  flowSpeed: number;
  frequency: number;
  amplitude: number;
};

type Particle = {
  offset: number;
  speed: number;
  lane: number;
  radius: number;
  phase: number;
  tint: string;
};

/** Dots riding the fibers. Azure and magenta read as accents against the violet strands. */
const PARTICLE_TINTS = [
  "56, 132, 255",
  "139, 92, 246",
  "217, 70, 239",
  "99, 102, 241",
  "232, 240, 255",
] as const;

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 91.713 + salt * 47.321) * 43758.5453;
  return value - Math.floor(value);
}

function cubicPoint(start: number, controlA: number, controlB: number, end: number, progress: number) {
  const inverse = 1 - progress;
  return (
    inverse ** 3 * start +
    3 * inverse ** 2 * progress * controlA +
    3 * inverse * progress ** 2 * controlB +
    progress ** 3 * end
  );
}

export function FiberFlowBackground({
  className,
  backgroundFill = "#f7f6ff",
  density = 88,
  particleCount = 60,
  speed = 1,
  targetSelector = "[data-fiber-flow-target]",
  ...props
}: FiberFlowBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!container || !canvas || !context) return;

    const fibers: Fiber[] = Array.from({ length: density }, (_, index) => ({
      spread: seededValue(index, 1) * 2 - 1,
      phase: seededValue(index, 2) * Math.PI * 2,
      width: 1.4 + seededValue(index, 3) * 1.45,
      alpha: 0.11 + seededValue(index, 4) * 0.23,
      hue: seededValue(index, 5),
      drift: 0.35 + seededValue(index, 6) * 0.75,
      flowSpeed: 0.7 + seededValue(index, 12) * 1.15,
      frequency: 1.35 + seededValue(index, 13) * 2.1,
      amplitude: 0.0025 + seededValue(index, 14) * 0.0045,
    }));
    const particles: Particle[] = Array.from({ length: particleCount }, (_, index) => ({
      offset: seededValue(index, 7),
      speed: 0.018 + seededValue(index, 8) * 0.03,
      lane: seededValue(index, 9) * 2 - 1,
      radius: 1.1 + seededValue(index, 10) * 2.1,
      phase: seededValue(index, 11) * Math.PI * 2,
      tint: PARTICLE_TINTS[Math.floor(seededValue(index, 15) * PARTICLE_TINTS.length) % PARTICLE_TINTS.length],
    }));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let startTime = performance.now();
    const focalPoint = { x: 0.51, y: 0.605 };
    const pointer = {
      x: 0.5,
      y: 0.605,
      targetX: 0.5,
      targetY: 0.605,
      strength: 0,
      targetStrength: 0,
    };
    const scroll = {
      progress: 0,
      targetProgress: 0,
      velocity: 0,
      targetVelocity: 0,
      lastY: window.scrollY,
      lastTimestamp: performance.now(),
    };

    const updateScrollProgress = () => {
      const travel = Math.max(height * 0.9, 1);
      scroll.targetProgress = Math.min(1, Math.max(0, window.scrollY / travel));
    };

    const updateFocalPoint = () => {
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!target) return;
      const containerBounds = container.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      focalPoint.x = Math.min(
        0.9,
        Math.max(0.1, (targetBounds.left + targetBounds.width / 2 - containerBounds.left) / containerBounds.width),
      );
      focalPoint.y = Math.min(
        0.9,
        Math.max(0.1, (targetBounds.top + targetBounds.height / 2 - containerBounds.top) / containerBounds.height),
      );
      pointer.targetX = focalPoint.x;
      pointer.targetY = focalPoint.y;
    };

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      updateFocalPoint();
    };

    const fiberGeometry = (fiber: Fiber, elapsed: number) => {
      const motion = Math.sin(elapsed * fiber.drift + fiber.phase) * height * 0.012;
      const scrollLift = scroll.progress * height;
      const startY =
        height * (0.49 + fiber.spread * 0.26) +
        motion -
        scrollLift * (0.1 + Math.abs(fiber.spread) * 0.02);
      const pointerPullY = (pointer.y - focalPoint.y) * height * 0.08 * pointer.strength;
      const pointerPullX = (pointer.x - focalPoint.x) * width * 0.06 * pointer.strength;
      const centerX = width * focalPoint.x;
      const centerY = height * focalPoint.y;
      const endY =
        height * (0.46 - fiber.spread * 0.28) +
        motion * 0.65 -
        scrollLift * (0.1 + Math.abs(fiber.spread) * 0.024);

      return {
        startX: -width * 0.08,
        startY,
        controlAX: width * 0.13,
        controlAY: startY + height * (0.12 + fiber.spread * 0.04),
        controlBX: centerX - width * 0.18 + pointerPullX,
        controlBY: centerY + fiber.spread * height * 0.025 + pointerPullY,
        centerX,
        centerY,
        controlCX: centerX + width * 0.18 + pointerPullX,
        controlCY: centerY - fiber.spread * height * 0.025 + pointerPullY,
        controlDX: width * 0.87,
        controlDY: endY + height * (0.15 - fiber.spread * 0.04),
        endX: width * 1.08,
        endY,
      };
    };

    const flowingFiberPoint = (
      fiber: Fiber,
      geometry: ReturnType<typeof fiberGeometry>,
      progress: number,
      elapsed: number,
    ) => {
      const firstHalf = progress <= 0.5;
      const localProgress = firstHalf ? progress * 2 : (progress - 0.5) * 2;
      const baseX = firstHalf
        ? cubicPoint(geometry.startX, geometry.controlAX, geometry.controlBX, geometry.centerX, localProgress)
        : cubicPoint(geometry.centerX, geometry.controlCX, geometry.controlDX, geometry.endX, localProgress);
      const baseY = firstHalf
        ? cubicPoint(geometry.startY, geometry.controlAY, geometry.controlBY, geometry.centerY, localProgress)
        : cubicPoint(geometry.centerY, geometry.controlCY, geometry.controlDY, geometry.endY, localProgress);

      // Settle at the outer edges and the URL-bar focal point while the body of each strand flows.
      const envelope = Math.sin(Math.PI * localProgress);
      const scrollEnergy = Math.min(1.4, Math.abs(scroll.velocity));
      const energy = 1 + pointer.strength * 0.7 + scrollEnergy * 1.45;
      const flowPhase =
        progress * Math.PI * 2 * fiber.frequency +
        elapsed * fiber.flowSpeed +
        scroll.progress * Math.PI * 5.4 * fiber.flowSpeed +
        scroll.velocity * Math.PI * 1.5 +
        fiber.phase;
      const primaryFlow = Math.sin(flowPhase);
      const secondaryFlow = Math.sin(flowPhase * 0.53 - elapsed * fiber.flowSpeed * 0.34) * 0.38;
      const displacement =
        (primaryFlow + secondaryFlow) * height * fiber.amplitude * envelope * energy;
      const lateralDrift =
        Math.cos(flowPhase * 0.72) * width * fiber.amplitude * 0.22 * envelope * energy;

      return {
        x: baseX + lateralDrift,
        y: baseY + displacement,
      };
    };

    const drawRibbon = (elapsed: number, offset: number, lineWidth: number, alpha: number) => {
      const scrollEnergy = Math.min(1.4, Math.abs(scroll.velocity));
      const wave =
        Math.sin(elapsed * 0.35 + offset + scroll.progress * Math.PI * 1.4) *
        height *
        0.022 *
        (1 + scrollEnergy * 0.7);
      const scrollLift = scroll.progress * height;
      const pointerPullX = (pointer.x - focalPoint.x) * width * 0.06 * pointer.strength;
      const pointerPullY = (pointer.y - focalPoint.y) * height * 0.08 * pointer.strength;
      const centerX = width * focalPoint.x;
      const centerY = height * focalPoint.y;
      const interactiveAlpha = alpha * (1 + pointer.strength * 0.28);
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `rgba(139, 92, 246, ${interactiveAlpha})`);
      gradient.addColorStop(0.2, `rgba(196, 181, 253, ${interactiveAlpha * 0.86})`);
      gradient.addColorStop(0.48, `rgba(245, 243, 255, ${interactiveAlpha * 0.38})`);
      gradient.addColorStop(0.74, `rgba(165, 180, 252, ${interactiveAlpha * 0.82})`);
      gradient.addColorStop(1, `rgba(79, 70, 229, ${interactiveAlpha})`);
      context.beginPath();
      context.moveTo(
        -width * 0.08,
        height * (0.5 + offset * 0.085) + wave - scrollLift * 0.08,
      );
      context.bezierCurveTo(
        width * 0.16,
        height * (0.64 + offset * 0.045) - scrollLift * 0.052,
        centerX - width * 0.18 + pointerPullX,
        centerY + height * (offset * 0.025) - wave + pointerPullY,
        centerX,
        centerY,
      );
      context.bezierCurveTo(
        centerX + width * 0.18 + pointerPullX,
        centerY - height * (offset * 0.02) + wave + pointerPullY,
        width * 0.84,
        height * (0.63 - offset * 0.05) - scrollLift * 0.06,
        width * 1.08,
        height * (0.46 - offset * 0.1) - wave - scrollLift * 0.1,
      );
      context.lineWidth = lineWidth;
      context.strokeStyle = gradient;
      context.stroke();
    };

    const draw = (timestamp: number) => {
      const elapsed = reducedMotion ? 0 : ((timestamp - startTime) / 1000) * speed;
      pointer.x += (pointer.targetX - pointer.x) * 0.07;
      pointer.y += (pointer.targetY - pointer.y) * 0.07;
      pointer.strength += (pointer.targetStrength - pointer.strength) * 0.06;
      scroll.progress += (scroll.targetProgress - scroll.progress) * 0.13;
      scroll.velocity += (scroll.targetVelocity - scroll.velocity) * 0.22;
      scroll.targetVelocity *= 0.9;
      context.clearRect(0, 0, width, height);
      context.fillStyle = backgroundFill;
      context.fillRect(0, 0, width, height);
      context.lineCap = "round";

      context.save();
      context.globalCompositeOperation = "multiply";
      drawRibbon(elapsed, -1, Math.max(18, height * 0.045), 0.09);
      drawRibbon(elapsed, 0.1, Math.max(26, height * 0.072), 0.12);
      drawRibbon(elapsed, 1, Math.max(16, height * 0.04), 0.088);

      fibers.forEach((fiber) => {
        const geometry = fiberGeometry(fiber, elapsed);
        const gradient = context.createLinearGradient(0, 0, width, 0);
        const leftColor = fiber.hue > 0.5 ? "124, 58, 237" : "147, 51, 234";
        const rightColor = fiber.hue > 0.5 ? "79, 70, 229" : "99, 102, 241";
        const interactiveAlpha = fiber.alpha * (1 + pointer.strength * 0.22);
        gradient.addColorStop(0, `rgba(${leftColor}, ${interactiveAlpha})`);
        gradient.addColorStop(0.18, `rgba(192, 132, 252, ${interactiveAlpha * 0.84})`);
        gradient.addColorStop(0.46, `rgba(255, 255, 255, ${interactiveAlpha * 0.34})`);
        gradient.addColorStop(0.72, `rgba(165, 180, 252, ${interactiveAlpha * 0.86})`);
        gradient.addColorStop(1, `rgba(${rightColor}, ${interactiveAlpha})`);
        context.beginPath();
        const sampleCount = width < 640 ? 24 : 36;
        for (let sample = 0; sample <= sampleCount; sample += 1) {
          const point = flowingFiberPoint(fiber, geometry, sample / sampleCount, elapsed);
          if (sample === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.lineWidth = fiber.width;
        context.strokeStyle = gradient;
        context.stroke();
      });
      context.restore();

      // Drawn source-over, not screen: screen against this near-white canvas
      // lifts every tint to white, which is why the dots read as colorless.
      context.save();
      particles.forEach((particle) => {
        const progress = reducedMotion ? particle.offset : (particle.offset + elapsed * particle.speed) % 1;
        const representative: Fiber = {
          spread: particle.lane,
          phase: particle.phase,
          width: 1,
          alpha: 1,
          hue: 0,
          drift: 0.55,
          flowSpeed: 1.1,
          frequency: 2.2,
          amplitude: 0.0035,
        };
        const geometry = fiberGeometry(representative, elapsed);
        const point = flowingFiberPoint(representative, geometry, progress, elapsed);
        const { x, y } = point;
        const pulse = 0.72 + Math.sin(elapsed * 1.8 + particle.phase) * 0.28;
        const radius = particle.radius * pulse * (1 + pointer.strength * 0.24);
        const haloRadius = radius * 4.5;
        const halo = context.createRadialGradient(x, y, 0, x, y, haloRadius);
        halo.addColorStop(0, `rgba(${particle.tint}, 0.3)`);
        halo.addColorStop(0.35, `rgba(${particle.tint}, 0.11)`);
        halo.addColorStop(1, `rgba(${particle.tint}, 0)`);
        context.fillStyle = halo;
        context.beginPath();
        context.arc(x, y, haloRadius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(${particle.tint}, ${0.9 * pulse})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();

      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    updateScrollProgress();
    scroll.progress = scroll.targetProgress;
    startTime = performance.now();
    draw(startTime);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (target) resizeObserver.observe(target);

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      const isInside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!isInside) {
        pointer.targetStrength = 0;
        return;
      }
      const normalizedX = (event.clientX - bounds.left) / bounds.width;
      const normalizedY = (event.clientY - bounds.top) / bounds.height;
      const target = event.target;
      const isOverControl =
        target instanceof Element &&
        Boolean(target.closest("form, a, button, input, select, textarea"));
      const isActive = !isOverControl && isOverFiberField(normalizedX, normalizedY);
      pointer.targetStrength = isActive ? 1 : 0;
      if (!isActive) return;
      pointer.targetX = normalizedX;
      pointer.targetY = normalizedY;
    };
    const clearPointer = () => {
      pointer.targetStrength = 0;
    };
    const handleScroll = () => {
      const timestamp = performance.now();
      const deltaTime = Math.max(16, timestamp - scroll.lastTimestamp);
      const deltaY = window.scrollY - scroll.lastY;
      updateScrollProgress();
      scroll.targetVelocity = Math.min(1.4, Math.max(-1.4, (deltaY / deltaTime) * 1.35));
      scroll.lastY = window.scrollY;
      scroll.lastTimestamp = timestamp;
    };
    const staticFiberY = (spread: number, progress: number) => {
      const startY = 0.49 + spread * 0.26;
      const centerY = focalPoint.y;
      const endY = 0.46 - spread * 0.28;
      if (progress <= 0.5) {
        const localProgress = progress * 2;
        return cubicPoint(
          startY,
          startY + 0.12 + spread * 0.04,
          centerY + spread * 0.025,
          centerY,
          localProgress,
        );
      }
      const localProgress = (progress - 0.5) * 2;
      return cubicPoint(
        centerY,
        centerY - spread * 0.025,
        endY + 0.15 - spread * 0.04,
        endY,
        localProgress,
      );
    };
    const isOverFiberField = (normalizedX: number, normalizedY: number) => {
      const progress = Math.min(1, Math.max(0, (normalizedX + 0.08) / 1.16));
      const edgeA = staticFiberY(-1, progress);
      const edgeB = staticFiberY(1, progress);
      const ribbonMargin = 0.035;
      return (
        normalizedY >= Math.min(edgeA, edgeB) - ribbonMargin &&
        normalizedY <= Math.max(edgeA, edgeB) + ribbonMargin
      );
    };
    if (!reducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("blur", clearPointer);
    }

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("blur", clearPointer);
    };
  }, [backgroundFill, density, particleCount, speed, targetSelector]);

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden", className)} {...props}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
    </div>
  );
}
