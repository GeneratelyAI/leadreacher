import { Job, Worker } from "bullmq";
import { getBullMqIdleDrainDelaySeconds } from "../config/env.js";
import {
  type OnboardingProspectDiscoveryJob,
  QUEUE_ONBOARDING_PROSPECT_DISCOVERY,
} from "../lib/queue.js";
import { redisSubscriber } from "../lib/redis.js";
import { runOnboardingProspectDiscovery } from "../services/onboarding-prospect-discovery.js";

export function startOnboardingProspectDiscoveryWorker(): Worker<OnboardingProspectDiscoveryJob> {
  return new Worker<OnboardingProspectDiscoveryJob>(
    QUEUE_ONBOARDING_PROSPECT_DISCOVERY,
    (job: Job<OnboardingProspectDiscoveryJob>) => runOnboardingProspectDiscovery(job.data),
    {
      connection: redisSubscriber,
      drainDelay: getBullMqIdleDrainDelaySeconds(),
    },
  );
}
