-- AlterTable
ALTER TABLE "Waitlist" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
