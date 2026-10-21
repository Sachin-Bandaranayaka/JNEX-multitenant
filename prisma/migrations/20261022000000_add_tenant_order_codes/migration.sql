ALTER TABLE "Tenant" ADD COLUMN "orderCodePrefix" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "orderCodeNextNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Order" ADD COLUMN "orderCode" TEXT;

CREATE UNIQUE INDEX "Order_tenantId_orderCode_key" ON "Order"("tenantId", "orderCode");
