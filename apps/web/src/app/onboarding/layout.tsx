import PageSurface from "@/components/layout/PageSurface";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageSurface surface="discovery" />
      <div className="onboarding-root min-h-dvh overflow-x-clip">
        {children}
      </div>
    </>
  );
}
