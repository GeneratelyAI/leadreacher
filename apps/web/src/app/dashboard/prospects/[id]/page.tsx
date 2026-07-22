import { ProspectDetailPanel } from "@/components/dashboard/ProspectDetailPanel";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProspectDetailPanel prospectId={id} presentation="page" />;
}
