import { Challenge } from "@/components/auth/Challenge";

export default async function VerifyMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <Challenge nextPath={next} />;
}
