-- CreateTable
CREATE TABLE "WhatsAppOnboardingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'START',
    "draftName" TEXT,
    "draftSymptoms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOnboardingSession_phone_key" ON "WhatsAppOnboardingSession"("phone");
