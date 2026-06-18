import { redirect } from "next/navigation";
import DiscoveryClient from "@/app/onboarding/discovery/DiscoveryClient";
import { createClient } from "@/lib/supabase/server";

function getUserInitials(input: {
  fullName?: string | null;
  email?: string | null;
}): string {
  const fullName = input.fullName?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  const email = input.email?.trim();
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "U";
}

export default async function DiscoveryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadata = user.user_metadata as {
    full_name?: string;
    name?: string;
  };

  const userInitials = getUserInitials({
    fullName: metadata.full_name ?? metadata.name ?? null,
    email: user.email,
  });

  return <DiscoveryClient userInitials={userInitials} />;
}
