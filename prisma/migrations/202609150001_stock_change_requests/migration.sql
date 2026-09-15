-- CreateTable
CREATE TABLE "StockChangeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "stockAdjustmentId" TEXT,

    CONSTRAINT "StockChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockChangeRequest_stockAdjustmentId_key" ON "StockChangeRequest"("stockAdjustmentId");

-- CreateIndex
CREATE INDEX "StockChangeRequest_tenantId_status_createdAt_idx" ON "StockChangeRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StockChangeRequest_productId_idx" ON "StockChangeRequest"("productId");

-- AddForeignKey
ALTER TABLE "StockChangeRequest" ADD CONSTRAINT "StockChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockChangeRequest" ADD CONSTRAINT "StockChangeRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockChangeRequest" ADD CONSTRAINT "StockChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockChangeRequest" ADD CONSTRAINT "StockChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockChangeRequest" ADD CONSTRAINT "StockChangeRequest_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

