import PageSurface from "@/components/layout/PageSurface";

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageSurface surface="auth" />
      <div className="flex min-h-dvh flex-1 flex-col bg-white dark:bg-[#0a0e14]">
        {children}
      </div>
    </>
  );
}
