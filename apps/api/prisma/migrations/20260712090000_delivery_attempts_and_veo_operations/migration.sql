-- Durable outreach reservations prevent duplicate provider sends across races
-- and BullMQ retries. Veo fields persist an active paid operation.
CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "campaignLeadId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "idempotencyKey" TEXT,
  "providerRef" TEXT,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryAttempt_campaignLeadId_stepIndex_key"
  ON "DeliveryAttempt"("campaignLeadId", "stepIndex");
CREATE UNIQUE INDEX "DeliveryAttempt_idempotencyKey_key"
  ON "DeliveryAttempt"("idempotencyKey");
CREATE INDEX "DeliveryAttempt_state_reservedAt_idx"
  ON "DeliveryAttempt"("state", "reservedAt");
ALTER TABLE "DeliveryAttempt"
  ADD CONSTRAINT "DeliveryAttempt_campaignLeadId_fkey"
  FOREIGN KEY ("campaignLeadId") REFERENCES "CampaignLead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoAsset"
  ADD COLUMN "veoOperationId" TEXT,
  ADD COLUMN "veoOperationState" TEXT,
  ADD COLUMN "veoSubmitLeaseAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "VideoAsset_veoOperationId_key" ON "VideoAsset"("veoOperationId");
CREATE INDEX "VideoAsset_veoOperationState_veoSubmitLeaseAt_idx"
  ON "VideoAsset"("veoOperationState", "veoSubmitLeaseAt");
