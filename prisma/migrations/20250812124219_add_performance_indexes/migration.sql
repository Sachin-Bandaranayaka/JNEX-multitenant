-- Add performance indexes for better query optimization

-- Index for User table - frequently queried by role and isActive status
CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- Index for Product table - frequently queried by isActive and stock levels
CREATE INDEX IF NOT EXISTS "Product_isActive_stock_idx" ON "Product"("isActive", "stock");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX IF NOT EXISTS "Product_lowStockAlert_idx" ON "Product"("lowStockAlert");

-- Index for Lead table - frequently queried by status and creation date
CREATE INDEX IF NOT EXISTS "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");

-- Index for Order table - frequently queried by status, dates, and customer info
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_shippedAt_idx" ON "Order"("shippedAt");
CREATE INDEX IF NOT EXISTS "Order_deliveredAt_idx" ON "Order"("deliveredAt");
CREATE INDEX IF NOT EXISTS "Order_customerPhone_idx" ON "Order"("customerPhone");
CREATE INDEX IF NOT EXISTS "Order_trackingNumber_idx" ON "Order"("trackingNumber");
CREATE INDEX IF NOT EXISTS "Order_shippingProvider_idx" ON "Order"("shippingProvider");

-- Index for StockAdjustment table - frequently queried by creation date
CREATE INDEX IF NOT EXISTS "StockAdjustment_createdAt_idx" ON "StockAdjustment"("createdAt");

-- Index for TrackingUpdate table - frequently queried by status and creation date
CREATE INDEX IF NOT EXISTS "TrackingUpdate_status_idx" ON "TrackingUpdate"("status");
CREATE INDEX IF NOT EXISTS "TrackingUpdate_createdAt_idx" ON "TrackingUpdate"("createdAt");

-- Index for Tenant table - frequently queried by isActive status
CREATE INDEX IF NOT EXISTS "Tenant_isActive_idx" ON "Tenant"("isActive");
CREATE INDEX IF NOT EXISTS "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Order_tenantId_status_createdAt_idx" ON "Order"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_status_createdAt_idx" ON "Lead"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_tenantId_isActive_idx" ON "Product"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "User_tenantId_isActive_idx" ON "User"("tenantId", "isActive");