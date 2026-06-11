-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "linkedinChatId" TEXT;

-- AlterTable
ALTER TABLE "Waitlist" ALTER COLUMN "id" DROP DEFAULT;
