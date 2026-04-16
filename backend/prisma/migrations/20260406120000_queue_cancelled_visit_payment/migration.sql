-- Visit payment tracking (manual; no payment gateway)
ALTER TABLE "Visit" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Visit" ADD COLUMN "amount" REAL;

-- QueueStatus.CANCELLED is a new enum label; SQLite stores status as TEXT, no ALTER needed for new values.
