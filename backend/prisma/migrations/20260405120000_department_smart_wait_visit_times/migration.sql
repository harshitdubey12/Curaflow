-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "department" TEXT NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE "Queue" ADD COLUMN "department" TEXT NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "startTime" DATETIME;
ALTER TABLE "Visit" ADD COLUMN "endTime" DATETIME;
