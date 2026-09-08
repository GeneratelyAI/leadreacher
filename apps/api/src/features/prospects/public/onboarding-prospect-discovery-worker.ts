import { Job, Worker } from "bullmq";
import { getBullMqIdleDrainDelaySeconds } from "../../../platform/config/env.js";
import {
  type OnboardingProspectDiscoveryJob,
  QUEUE_ONBOARDING_PROSPECT_DISCOVERY,
} from "../../../lib/queue.js";
import { redisSubscriber } from "../../../platform/redis/connection.js";
import { runOnboardingProspectDiscovery } from "./onboarding-prospect-discovery.js";

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
