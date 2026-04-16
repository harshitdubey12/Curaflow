-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'walkin',
    "appointmentTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastNotifiedAt" DATETIME,
    "lastResponseAt" DATETIME,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "summonedAt" DATETIME,
    CONSTRAINT "Queue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Queue_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Queue" ("id", "tokenNumber", "status", "patientId", "doctorId", "priority", "type", "appointmentTime", "createdAt", "updatedAt", "lastNotifiedAt", "lastResponseAt", "notified", "summonedAt")
SELECT "id", "tokenNumber", "status", "patientId", "doctorId", "priority", "type", "appointmentTime", "createdAt", "createdAt", NULL, NULL, 0, NULL FROM "Queue";
DROP TABLE "Queue";
ALTER TABLE "new_Queue" RENAME TO "Queue";
CREATE UNIQUE INDEX "Queue_tokenNumber_key" ON "Queue"("tokenNumber");
CREATE INDEX "Queue_doctorId_status_idx" ON "Queue"("doctorId", "status");
CREATE TABLE "new_Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpSent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Visit" ("id", "patientId", "status", "createdAt", "followUpSent")
SELECT "id", "patientId", "status", "createdAt", 0 FROM "Visit";
DROP TABLE "Visit";
ALTER TABLE "new_Visit" RENAME TO "Visit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
