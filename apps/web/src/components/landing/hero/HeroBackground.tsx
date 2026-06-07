import Image from "next/image";

export default function HeroBackground() {
  return (
    <Image
      src="/BG.png"
      alt=""
      fill
      priority
      sizes="100vw"
      className="absolute inset-0 z-1 object-cover object-center"
      aria-hidden
    />
  );
}
