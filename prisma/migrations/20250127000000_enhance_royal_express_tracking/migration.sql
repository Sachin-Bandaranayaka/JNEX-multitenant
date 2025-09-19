-- Enhanced Royal Express Tracking Migration
-- This migration adds support for the new Royal Express API features including:
-- 1. Enhanced order status tracking with 21 status types
-- 2. Financial information integration
-- 3. Detailed tracking information with location data
-- 4. Order lifecycle management

-- Add new columns to TrackingUpdate table for enhanced Royal Express tracking
ALTER TABLE "TrackingUpdate" ADD COLUMN "provider" TEXT;
ALTER TABLE "TrackingUpdate" ADD COLUMN "statusCode" TEXT;
ALTER TABLE "TrackingUpdate" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "TrackingUpdate" ADD COLUMN "estimatedDelivery" TIMESTAMP(3);
ALTER TABLE "TrackingUpdate" ADD COLUMN "actualDelivery" TIMESTAMP(3);
ALTER TABLE "TrackingUpdate" ADD COLUMN "locationCode" TEXT;
ALTER TABLE "TrackingUpdate" ADD COLUMN "locationName" TEXT;
ALTER TABLE "TrackingUpdate" ADD COLUMN "coordinates" TEXT; -- JSON string for lat/lng
ALTER TABLE "TrackingUpdate" ADD COLUMN "isDelivered" BOOLEAN DEFAULT false;
ALTER TABLE "TrackingUpdate" ADD COLUMN "isException" BOOLEAN DEFAULT false;
ALTER TABLE "TrackingUpdate" ADD COLUMN "exceptionReason" TEXT;

-- Create new table for Royal Express Order Financial Information
CREATE TABLE "OrderFinancialInfo" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Multi-tenancy support
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "OrderFinancialInfo_pkey" PRIMARY KEY ("id")
);

-- Create new table for Enhanced Order Status History
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "isCurrentStatus" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Multi-tenancy support
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Create new table for Royal Express Tracking Details
CREATE TABLE "RoyalExpressTrackingDetail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "currentStatus" TEXT NOT NULL,
    "currentStatusCode" TEXT NOT NULL,
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "lastLocationUpdate" TEXT,
    "lastLocationTimestamp" TIMESTAMP(3),
    "totalStatusUpdates" INTEGER DEFAULT 0,
    "isDelivered" BOOLEAN DEFAULT false,
    "isException" BOOLEAN DEFAULT false,
    "exceptionDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Multi-tenancy support
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "RoyalExpressTrackingDetail_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "OrderFinancialInfo" ADD CONSTRAINT "OrderFinancialInfo_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderFinancialInfo" ADD CONSTRAINT "OrderFinancialInfo_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoyalExpressTrackingDetail" ADD CONSTRAINT "RoyalExpressTrackingDetail_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoyalExpressTrackingDetail" ADD CONSTRAINT "RoyalExpressTrackingDetail_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX "TrackingUpdate_provider_idx" ON "TrackingUpdate"("provider");
CREATE INDEX "TrackingUpdate_statusCode_idx" ON "TrackingUpdate"("statusCode");
CREATE INDEX "TrackingUpdate_trackingNumber_idx" ON "TrackingUpdate"("trackingNumber");
CREATE INDEX "TrackingUpdate_isDelivered_idx" ON "TrackingUpdate"("isDelivered");
CREATE INDEX "TrackingUpdate_isException_idx" ON "TrackingUpdate"("isException");

CREATE INDEX "OrderFinancialInfo_orderId_idx" ON "OrderFinancialInfo"("orderId");
CREATE INDEX "OrderFinancialInfo_tenantId_idx" ON "OrderFinancialInfo"("tenantId");
CREATE INDEX "OrderFinancialInfo_paymentStatus_idx" ON "OrderFinancialInfo"("paymentStatus");

CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
CREATE INDEX "OrderStatusHistory_tenantId_idx" ON "OrderStatusHistory"("tenantId");
CREATE INDEX "OrderStatusHistory_statusCode_idx" ON "OrderStatusHistory"("statusCode");
CREATE INDEX "OrderStatusHistory_timestamp_idx" ON "OrderStatusHistory"("timestamp");
CREATE INDEX "OrderStatusHistory_isCurrentStatus_idx" ON "OrderStatusHistory"("isCurrentStatus");

CREATE INDEX "RoyalExpressTrackingDetail_orderId_idx" ON "RoyalExpressTrackingDetail"("orderId");
CREATE INDEX "RoyalExpressTrackingDetail_tenantId_idx" ON "RoyalExpressTrackingDetail"("tenantId");
CREATE INDEX "RoyalExpressTrackingDetail_trackingNumber_idx" ON "RoyalExpressTrackingDetail"("trackingNumber");
CREATE INDEX "RoyalExpressTrackingDetail_currentStatusCode_idx" ON "RoyalExpressTrackingDetail"("currentStatusCode");
CREATE INDEX "RoyalExpressTrackingDetail_isDelivered_idx" ON "RoyalExpressTrackingDetail"("isDelivered");
CREATE INDEX "RoyalExpressTrackingDetail_isException_idx" ON "RoyalExpressTrackingDetail"("isException");

-- Create unique constraints to prevent duplicate records
ALTER TABLE "OrderFinancialInfo" ADD CONSTRAINT "OrderFinancialInfo_orderId_key" UNIQUE ("orderId");
ALTER TABLE "RoyalExpressTrackingDetail" ADD CONSTRAINT "RoyalExpressTrackingDetail_orderId_key" UNIQUE ("orderId");

-- Add composite indexes for common query patterns
CREATE INDEX "OrderStatusHistory_orderId_timestamp_idx" ON "OrderStatusHistory"("orderId", "timestamp");
CREATE INDEX "TrackingUpdate_orderId_provider_timestamp_idx" ON "TrackingUpdate"("orderId", "provider", "timestamp");
CREATE INDEX "RoyalExpressTrackingDetail_tenantId_isDelivered_idx" ON "RoyalExpressTrackingDetail"("tenantId", "isDelivered");