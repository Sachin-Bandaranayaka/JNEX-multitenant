CREATE TABLE "ShipmentBatch" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider" "ShippingProvider" NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ShipmentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "ShipmentBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentBatch_tenantId_createdAt_idx" ON "ShipmentBatch"("tenantId", "createdAt");
CREATE UNIQUE INDEX "ShipmentBatchItem_orderId_key" ON "ShipmentBatchItem"("orderId");
CREATE UNIQUE INDEX "ShipmentBatchItem_batchId_position_key" ON "ShipmentBatchItem"("batchId", "position");
ALTER TABLE "ShipmentBatch" ADD CONSTRAINT "ShipmentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentBatch" ADD CONSTRAINT "ShipmentBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentBatchItem" ADD CONSTRAINT "ShipmentBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ShipmentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentBatchItem" ADD CONSTRAINT "ShipmentBatchItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
