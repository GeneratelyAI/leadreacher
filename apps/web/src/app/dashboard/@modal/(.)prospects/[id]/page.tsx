import { ProspectDetailPanel } from "@/components/dashboard/ProspectDetailPanel";

export default async function InterceptedProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProspectDetailPanel prospectId={id} presentation="drawer" />;
}
