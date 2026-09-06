import Surface from "@/components/layout/Surface";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Surface surface="discovery" />
      <div className="onboarding-root min-h-dvh overflow-x-clip">
        {children}
      </div>
    </>
  );
}
