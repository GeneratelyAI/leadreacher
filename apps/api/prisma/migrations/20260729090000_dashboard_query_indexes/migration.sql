-- Dashboard list, timeline, and metric reads are predominantly organization
-- scoped and ordered or filtered by time. These indexes match those paths.
CREATE INDEX "Lead_orgId_createdAt_idx" ON "Lead"("orgId", "createdAt");
CREATE INDEX "Lead_orgId_updatedAt_idx" ON "Lead"("orgId", "updatedAt");
CREATE INDEX "CampaignLead_campaignId_status_createdAt_idx" ON "CampaignLead"("campaignId", "status", "createdAt");
CREATE INDEX "Message_orgId_createdAt_idx" ON "Message"("orgId", "createdAt");
CREATE INDEX "Message_orgId_direction_createdAt_idx" ON "Message"("orgId", "direction", "createdAt");
CREATE INDEX "Message_campaignId_createdAt_idx" ON "Message"("campaignId", "createdAt");
CREATE INDEX "VideoAsset_orgId_updatedAt_idx" ON "VideoAsset"("orgId", "updatedAt");
