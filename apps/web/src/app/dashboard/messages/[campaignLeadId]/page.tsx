import { Messages } from "@/components/dashboard/Messages";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ campaignLeadId: string }>;
}) {
  const { campaignLeadId } = await params;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <Messages conversationId={campaignLeadId} />
    </div>
  );
}
