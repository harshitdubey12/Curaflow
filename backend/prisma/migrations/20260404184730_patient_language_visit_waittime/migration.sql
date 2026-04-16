-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "waitTime" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "symptoms" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Patient" ("createdAt", "id", "name", "phone", "symptoms") SELECT "createdAt", "id", "name", "phone", "symptoms" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_phone_key" ON "Patient"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
