import PageSurface from "@/components/layout/PageSurface";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageSurface surface="discovery" />
      <div className="h-dvh max-h-dvh min-h-dvh overflow-hidden bg-[#FAFAF9] dark:bg-[#0a0a1a]">
        {children}
      </div>
    </>
  );
}
