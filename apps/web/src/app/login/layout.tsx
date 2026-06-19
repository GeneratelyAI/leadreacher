import PageSurface from "@/components/layout/PageSurface";
import { authPageInitScript } from "@/lib/auth-page-init-script";
import Script from "next/script";

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script
        id="lr-auth-page-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: authPageInitScript }}
      />
      <PageSurface surface="auth" />
      <div className="flex min-h-dvh flex-1 flex-col bg-[#ece8f3] dark:bg-[#0a0a1a]">
        {children}
      </div>
    </>
  );
}
