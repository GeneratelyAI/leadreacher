ALTER TABLE "Campaign"
ADD COLUMN "suspensionReason" TEXT;

CREATE INDEX "Campaign_orgId_suspensionReason_idx"
ON "Campaign"("orgId", "suspensionReason");
