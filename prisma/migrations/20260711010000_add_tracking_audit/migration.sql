ALTER TABLE "Order" ADD COLUMN "lastTrackingCheckedAt" TIMESTAMP(3),
ADD COLUMN "trackingFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "trackingLastError" TEXT;
CREATE INDEX "Order_status_lastTrackingCheckedAt_idx" ON "Order"("status", "lastTrackingCheckedAt");
