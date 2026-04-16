-- Visit: throttle follow-up retries after Twilio failure
ALTER TABLE "Visit" ADD COLUMN "followUpLastAttemptAt" DATETIME;

-- Distributed lock for clinic background jobs (optional; enable via CLINIC_JOBS_USE_DB_LEASE=true)
CREATE TABLE "JobLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseUntil" DATETIME NOT NULL,
    "leaseHolder" TEXT NOT NULL
);

INSERT INTO "JobLease" ("id", "leaseUntil", "leaseHolder") VALUES ('clinic-jobs', '1970-01-01T00:00:00.000Z', 'bootstrap');
