-- Multi-channel Unipile: campaign senders, lead provider ids, generic chat/email keys

CREATE TABLE "CampaignChannelAccount" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignChannelAccount_campaignId_channel_key" ON "CampaignChannelAccount"("campaignId", "channel");
CREATE INDEX "CampaignChannelAccount_socialAccountId_idx" ON "CampaignChannelAccount"("socialAccountId");

ALTER TABLE "CampaignChannelAccount" ADD CONSTRAINT "CampaignChannelAccount_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignChannelAccount" ADD CONSTRAINT "CampaignChannelAccount_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill LinkedIn senders from legacy Campaign.socialAccountId
INSERT INTO "CampaignChannelAccount" ("id", "campaignId", "channel", "socialAccountId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'linkedin', c."socialAccountId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."socialAccountId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CampaignChannelAccount" existing
    WHERE existing."campaignId" = c."id"
      AND existing."channel" = 'linkedin'
  );

ALTER TABLE "Lead" ADD COLUMN "providerWhatsappId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "providerFacebookId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "providerInstagramId" TEXT;
CREATE INDEX "Lead_orgId_phone_idx" ON "Lead"("orgId", "phone");

ALTER TABLE "CampaignLead" ADD COLUMN "providerChatId" TEXT;
ALTER TABLE "CampaignLead" ADD COLUMN "emailThreadKey" TEXT;
CREATE UNIQUE INDEX "CampaignLead_providerChatId_key" ON "CampaignLead"("providerChatId");
CREATE INDEX "CampaignLead_emailThreadKey_idx" ON "CampaignLead"("emailThreadKey");

-- Copy existing LinkedIn chat ids into the generic column
UPDATE "CampaignLead"
SET "providerChatId" = "linkedinChatId"
WHERE "linkedinChatId" IS NOT NULL AND "providerChatId" IS NULL;
