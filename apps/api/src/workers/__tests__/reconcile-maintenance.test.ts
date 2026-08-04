import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  reconcileCampaignStepZeroJobs,
  reconcileDeliveryAttempts,
  reconcilePendingConnections,
  reconcileUnknownTemplateVeoOperations,
  reconcileUnknownVeoOperations,
} = vi.hoisted(() => ({
  reconcileCampaignStepZeroJobs: vi.fn(),
  reconcileDeliveryAttempts: vi.fn(),
  reconcilePendingConnections: vi.fn(),
  reconcileUnknownTemplateVeoOperations: vi.fn(),
  reconcileUnknownVeoOperations: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    on() {
      return this;
    }
  },
}));
vi.mock("../../config/env.js", () => ({
  env: { RESEND_API_KEY: "" },
  getBullMqIdleDrainDelaySeconds: () => 60,
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_RECONCILE_MAINTENANCE: "reconcile-maintenance",
  RECONCILE_MAINTENANCE_INTERVAL_MS: 2 * 60 * 1000,
  scheduleReconciliationMaintenance: vi.fn(),
}));
vi.mock("../../lib/redis.js", () => ({ redisSubscriber: {} }));
vi.mock("../reconcile-campaign-enrollments.js", () => ({
  reconcileCampaignStepZeroJobs,
}));
vi.mock("../reconcile-delivery-attempts.js", () => ({
  reconcileDeliveryAttempts,
}));
vi.mock("../reconcile-relations.js", () => ({ reconcilePendingConnections }));
vi.mock("../video-generation.js", () => ({
  reconcileUnknownTemplateVeoOperations,
  reconcileUnknownVeoOperations,
}));
vi.mock("../../services/product-email-outbox.js", () => ({ processProductEmailOutbox: vi.fn() }));
vi.mock("../../services/organization-export.js", () => ({ processOrganizationExports: vi.fn() }));
vi.mock("../../services/organization-lifecycle.js", () => ({ purgeExpiredOrganizations: vi.fn() }));

import {
  isMaintenanceTaskDue,
  runReconciliationMaintenance,
} from "../reconcile-maintenance.js";

const MINUTE = 60 * 1000;

beforeEach(() => {
  reconcileCampaignStepZeroJobs.mockReset().mockResolvedValue({ checked: 0 });
  reconcileDeliveryAttempts.mockReset().mockResolvedValue({ markedUnknown: 0 });
  reconcilePendingConnections.mockReset().mockResolvedValue({ checked: 0 });
  reconcileUnknownTemplateVeoOperations.mockReset().mockResolvedValue({ checked: 0 });
  reconcileUnknownVeoOperations.mockReset().mockResolvedValue({ checked: 0 });
});

describe("reconciliation maintenance", () => {
  it("runs lower-frequency work only when its boundary is crossed", () => {
    expect(isMaintenanceTaskDue(10 * MINUTE, 5 * MINUTE)).toBe(true);
    expect(isMaintenanceTaskDue(10 * MINUTE, 10 * MINUTE)).toBe(true);
    expect(isMaintenanceTaskDue(12 * MINUTE, 5 * MINUTE)).toBe(false);
    expect(isMaintenanceTaskDue(12 * MINUTE, 10 * MINUTE)).toBe(false);
  });

  it("combines reconciliation work into one scheduled queue execution", async () => {
    const result = await runReconciliationMaintenance(
      { reconcileEnabled: true, videoEnabled: true },
      10 * MINUTE,
    );

    expect(reconcileCampaignStepZeroJobs).toHaveBeenCalledTimes(1);
    expect(reconcileDeliveryAttempts).toHaveBeenCalledTimes(1);
    expect(reconcilePendingConnections).toHaveBeenCalledTimes(1);
    expect(reconcileUnknownVeoOperations).toHaveBeenCalledTimes(1);
    expect(reconcileUnknownTemplateVeoOperations).toHaveBeenCalledTimes(1);
    expect(Object.keys(result)).toEqual([
      "campaign-enrollments",
      "delivery-attempts",
      "relations",
      "veo-operations",
    ]);
  });

  it("does not run disabled maintenance categories", async () => {
    await runReconciliationMaintenance(
      { reconcileEnabled: false, videoEnabled: false },
      10 * MINUTE,
    );

    expect(reconcileCampaignStepZeroJobs).not.toHaveBeenCalled();
    expect(reconcileDeliveryAttempts).not.toHaveBeenCalled();
    expect(reconcilePendingConnections).not.toHaveBeenCalled();
    expect(reconcileUnknownVeoOperations).not.toHaveBeenCalled();
  });
});
