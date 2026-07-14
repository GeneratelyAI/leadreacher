import { NextResponse } from "next/server";
import { bootstrapOrganizationServer } from "@/lib/api/server";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding?step=discovery";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (session?.access_token && user?.email) {
    try {
      await bootstrapOrganizationServer(
        session.access_token,
        defaultOrgNameFromEmail(user.email),
      );
    } catch {
      // Idempotent bootstrap; ignore if org already exists.
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
