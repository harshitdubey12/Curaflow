-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "doctorId" TEXT;

-- CreateIndex
CREATE INDEX "Visit_doctorId_idx" ON "Visit"("doctorId");
