import { ProspectDetails } from "@/components/dashboard/ProspectDetails";

export default async function InterceptedProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProspectDetails prospectId={id} presentation="drawer" />;
}
