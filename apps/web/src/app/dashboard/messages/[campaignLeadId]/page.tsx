import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";
import { MessagesWorkspace } from "@/components/dashboard/MessagesWorkspace";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ campaignLeadId: string }>;
}) {
  const { campaignLeadId } = await params;
  return (
    <DashboardPageFrame className="flex min-h-0 flex-1 flex-col max-lg:h-full max-lg:max-w-none max-lg:px-0 max-lg:py-0 lg:block">
      <MessagesWorkspace conversationId={campaignLeadId} />
    </DashboardPageFrame>
  );
}
