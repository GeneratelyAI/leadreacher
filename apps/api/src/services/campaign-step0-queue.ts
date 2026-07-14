import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";

export type StepZeroQueueState =
  | "enqueued"
  | "pending"
  | "failed"
  | "completed";

export function classifyExistingStepZeroJobState(
  state: string | undefined,
): Exclude<StepZeroQueueState, "enqueued"> {
  if (state === "failed") return "failed";
  if (state === "completed") return "completed";
  return "pending";
}

/**
 * Queue step 0 once. BullMQ keeps failed/completed jobs by default, so those
 * states must be surfaced rather than treated as a safe duplicate add.
 */
export async function ensureCampaignStepZeroQueued(input: {
  campaignLeadId: string;
  orgId: string;
}): Promise<StepZeroQueueState> {
  const jobId = campaignSequenceJobId(input.campaignLeadId, 0);
  const existing = await campaignSequenceQueue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    return classifyExistingStepZeroJobState(state);
  }

  await campaignSequenceQueue.add(
    QUEUE_CAMPAIGN_SEQUENCE,
    { campaignLeadId: input.campaignLeadId, orgId: input.orgId, step: 0 },
    { jobId },
  );
  return "enqueued";
}
