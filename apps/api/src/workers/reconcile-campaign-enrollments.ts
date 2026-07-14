import { Worker } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { redisSubscriber } from "../lib/redis.js";
import {
  QUEUE_RECONCILE_CAMPAIGN_ENROLLMENTS,
  scheduleCampaignEnrollmentReconciliation,
} from "../lib/queue.js";
import { ensureCampaignStepZeroQueued } from "../services/campaign-step0-queue.js";

const BATCH_SIZE = 100;

export async function reconcileCampaignStepZeroJobs(): Promise<{
  checked: number;
  enqueued: number;
  flagged: number;
}> {
  // Lead.status has no "active" state; CampaignLead.status is the durable
  // enrollment intent and currentStep=0 identifies an unstarted sequence.
  const candidates = await prisma.campaignLead.findMany({
    where: {
      status: "active",
      currentStep: 0,
      campaign: { status: "active" },
    },
    include: { campaign: { select: { orgId: true } } },
    take: BATCH_SIZE,
  });

  let enqueued = 0;
  let flagged = 0;
  for (const candidate of candidates) {
    const state = await ensureCampaignStepZeroQueued({
      campaignLeadId: candidate.id,
      orgId: candidate.campaign.orgId,
    });
    if (state === "enqueued") {
      enqueued += 1;
      continue;
    }
    if (state === "failed" || state === "completed") {
      flagged += 1;
      await prisma.auditLog.create({
        data: {
          orgId: candidate.campaign.orgId,
          action: "campaign.step0.queue_inconsistent",
          resource: "CampaignLead",
          resourceId: candidate.id,
          metadata: { queueState: state, currentStep: candidate.currentStep },
        },
      });
    }
  }

  return { checked: candidates.length, enqueued, flagged };
}

export function startCampaignEnrollmentReconciliationWorker(): Worker {
  const worker = new Worker(
    QUEUE_RECONCILE_CAMPAIGN_ENROLLMENTS,
    async () => reconcileCampaignStepZeroJobs(),
    { connection: redisSubscriber },
  );

  worker.on("failed", (job, error) => {
    console.error(`Campaign enrollment reconcile job ${job?.id} failed:`, error.message);
  });

  void scheduleCampaignEnrollmentReconciliation();
  return worker;
}
