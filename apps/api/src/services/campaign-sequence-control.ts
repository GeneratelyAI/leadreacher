import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { parseSequence } from "../lib/sequence.js";
import { ensureCampaignStepZeroQueued } from "./campaign-step0-queue.js";

/**
 * Remove queued BullMQ sequence jobs for every lead in a campaign.
 * Safe when jobs are already gone (remove throws / missing).
 */
export async function cancelCampaignPendingSequenceJobs(input: {
  campaignId: string;
  orgId: string;
}): Promise<number> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, orgId: input.orgId },
    select: {
      sequence: true,
      leads: { select: { id: true, currentStep: true } },
    },
  });
  if (!campaign) return 0;

  let sequenceLength = 1;
  try {
    sequenceLength = parseSequence(campaign.sequence).length;
  } catch {
    sequenceLength = 8;
  }

  let removed = 0;
  for (const lead of campaign.leads) {
    for (let step = 0; step < sequenceLength; step += 1) {
      try {
        await campaignSequenceQueue.remove(campaignSequenceJobId(lead.id, step));
        removed += 1;
      } catch {
        // Job may not exist - ignore.
      }
    }
  }
  return removed;
}

/**
 * After resume, re-queue the current step for each active enrollment.
 * Step 0 uses the idempotent helper; later steps are added fresh.
 */
export async function resumeCampaignSequenceJobs(input: {
  campaignId: string;
  orgId: string;
}): Promise<number> {
  const leads = await prisma.campaignLead.findMany({
    where: { campaignId: input.campaignId, status: "active" },
    select: { id: true, currentStep: true },
  });

  let queued = 0;
  for (const lead of leads) {
    const step = Math.max(0, lead.currentStep);
    if (step === 0) {
      try {
        const state = await ensureCampaignStepZeroQueued({
          campaignLeadId: lead.id,
          orgId: input.orgId,
        });
        if (state === "enqueued" || state === "pending") queued += 1;
      } catch {
        // Reconciler can retry.
      }
      continue;
    }

    const jobId = campaignSequenceJobId(lead.id, step);
    try {
      const existing = await campaignSequenceQueue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === "waiting" || state === "delayed" || state === "active") {
          queued += 1;
          continue;
        }
        await existing.remove().catch(() => undefined);
      }
      await campaignSequenceQueue.add(
        QUEUE_CAMPAIGN_SEQUENCE,
        { campaignLeadId: lead.id, orgId: input.orgId, step },
        { jobId },
      );
      queued += 1;
    } catch {
      // Reconciler can retry.
    }
  }
  return queued;
}
