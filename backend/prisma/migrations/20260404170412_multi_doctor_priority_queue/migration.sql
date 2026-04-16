-- AlterTable Doctor: optional specialization
ALTER TABLE "Doctor" ADD COLUMN "specialization" TEXT;

-- Default doctor for existing Queue rows (id must match DEFAULT_DOCTOR_ID in app config)
INSERT OR IGNORE INTO "Doctor" ("id", "name", "specialization") VALUES ('clinic-default-doctor', 'General Clinic', NULL);

-- Redefine Queue with doctor, priority, type, appointment
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
    CONSTRAINT "Queue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Queue_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Queue" ("createdAt", "id", "patientId", "status", "tokenNumber", "doctorId", "priority", "type", "appointmentTime")
SELECT "createdAt", "id", "patientId", "status", "tokenNumber", 'clinic-default-doctor', 0, 'walkin', NULL FROM "Queue";
DROP TABLE "Queue";
ALTER TABLE "new_Queue" RENAME TO "Queue";
CREATE UNIQUE INDEX "Queue_tokenNumber_key" ON "Queue"("tokenNumber");
CREATE INDEX "Queue_doctorId_status_idx" ON "Queue"("doctorId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
