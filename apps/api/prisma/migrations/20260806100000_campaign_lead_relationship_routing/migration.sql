ALTER TABLE "CampaignLead"
ADD COLUMN "linkedinRelationship" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "relationshipCheckedAt" TIMESTAMP(3),
ADD COLUMN "relationshipSenderId" TEXT;

CREATE INDEX "CampaignLead_campaignId_relationshipSenderId_linkedinRelationship_idx"
ON "CampaignLead"("campaignId", "relationshipSenderId", "linkedinRelationship");
