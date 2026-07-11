CREATE TABLE "InvoicePrintBatch" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "InvoicePrintBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InvoicePrintBatchItem" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "batchId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  CONSTRAINT "InvoicePrintBatchItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoicePrintBatch_tenantId_createdAt_idx" ON "InvoicePrintBatch"("tenantId", "createdAt");
CREATE INDEX "InvoicePrintBatch_userId_createdAt_idx" ON "InvoicePrintBatch"("userId", "createdAt");
CREATE UNIQUE INDEX "InvoicePrintBatchItem_batchId_orderId_key" ON "InvoicePrintBatchItem"("batchId", "orderId");
CREATE UNIQUE INDEX "InvoicePrintBatchItem_batchId_position_key" ON "InvoicePrintBatchItem"("batchId", "position");
CREATE INDEX "InvoicePrintBatchItem_orderId_idx" ON "InvoicePrintBatchItem"("orderId");
ALTER TABLE "InvoicePrintBatch" ADD CONSTRAINT "InvoicePrintBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePrintBatch" ADD CONSTRAINT "InvoicePrintBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePrintBatchItem" ADD CONSTRAINT "InvoicePrintBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InvoicePrintBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePrintBatchItem" ADD CONSTRAINT "InvoicePrintBatchItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
