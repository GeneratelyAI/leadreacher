-- A client-generated key makes operator reply retries idempotent. NULL remains
-- valid for automated and historical messages, which do not participate here.
ALTER TABLE "Message" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Message_idempotencyKey_key" ON "Message"("idempotencyKey");
