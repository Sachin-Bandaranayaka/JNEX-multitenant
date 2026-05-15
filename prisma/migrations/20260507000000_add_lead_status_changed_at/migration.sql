-- Add statusChangedAt to Lead. Default to now() at the column level for new rows;
-- backfill existing rows from updatedAt so historical data still produces sane filtering.
ALTER TABLE "Lead" ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: use updatedAt as a best-effort proxy for the previous status-change time.
UPDATE "Lead" SET "statusChangedAt" = "updatedAt";

-- Index for efficient filtering by status-change date.
CREATE INDEX "Lead_statusChangedAt_idx" ON "Lead"("statusChangedAt");
