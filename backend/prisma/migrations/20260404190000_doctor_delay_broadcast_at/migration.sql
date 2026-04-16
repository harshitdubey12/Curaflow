-- Persist last doctor-delay broadcast time for multi-instance safety
ALTER TABLE "Doctor" ADD COLUMN "lastDelayBroadcastAt" DATETIME;
