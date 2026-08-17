-- CreateEnum
CREATE TYPE "FeeModel" AS ENUM ('FLAT_PER_ORDER', 'PERCENT_OF_ORDER', 'TIERED_BY_VOLUME');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('ACCRUED', 'INVOICED', 'PAID', 'REVERSED', 'WAIVED');

-- CreateEnum
CREATE TYPE "TenantInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "TenantFeeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feeModel" "FeeModel" NOT NULL DEFAULT 'FLAT_PER_ORDER',
    "flatAmount" DECIMAL(12,2),
    "percentRate" DECIMAL(9,6),
    "tiers" JSONB,
    "minFee" DECIMAL(12,2),
    "maxFee" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvoice" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "TenantInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "chargeCount" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "adjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "feeModel" "FeeModel" NOT NULL,
    "orderTotal" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "status" "ChargeStatus" NOT NULL DEFAULT 'ACCRUED',
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodSequence" INTEGER NOT NULL,
    "invoiceId" TEXT,
    "creditInvoiceId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "waivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "bankReceiptNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "transferTime" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "InvoicePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantFeeRate_tenantId_effectiveFrom_idx" ON "TenantFeeRate"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TenantFeeRate_tenantId_effectiveTo_idx" ON "TenantFeeRate"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "TenantInvoice_tenantId_status_idx" ON "TenantInvoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantInvoice_status_idx" ON "TenantInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvoice_tenantId_periodKey_key" ON "TenantInvoice"("tenantId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCharge_orderId_key" ON "DeliveryCharge"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryCharge_tenantId_periodKey_status_idx" ON "DeliveryCharge"("tenantId", "periodKey", "status");

-- CreateIndex
CREATE INDEX "DeliveryCharge_tenantId_deliveredAt_idx" ON "DeliveryCharge"("tenantId", "deliveredAt");

-- CreateIndex
CREATE INDEX "DeliveryCharge_invoiceId_idx" ON "DeliveryCharge"("invoiceId");

-- CreateIndex
CREATE INDEX "DeliveryCharge_creditInvoiceId_idx" ON "DeliveryCharge"("creditInvoiceId");

-- CreateIndex
CREATE INDEX "DeliveryCharge_status_idx" ON "DeliveryCharge"("status");

-- CreateIndex
CREATE INDEX "TenantInvoicePayment_invoiceId_idx" ON "TenantInvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "TenantInvoicePayment_tenantId_status_idx" ON "TenantInvoicePayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantInvoicePayment_status_idx" ON "TenantInvoicePayment"("status");

-- AddForeignKey
ALTER TABLE "TenantFeeRate" ADD CONSTRAINT "TenantFeeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvoice" ADD CONSTRAINT "TenantInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCharge" ADD CONSTRAINT "DeliveryCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCharge" ADD CONSTRAINT "DeliveryCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCharge" ADD CONSTRAINT "DeliveryCharge_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "TenantFeeRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCharge" ADD CONSTRAINT "DeliveryCharge_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TenantInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCharge" ADD CONSTRAINT "DeliveryCharge_creditInvoiceId_fkey" FOREIGN KEY ("creditInvoiceId") REFERENCES "TenantInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvoicePayment" ADD CONSTRAINT "TenantInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TenantInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvoicePayment" ADD CONSTRAINT "TenantInvoicePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvoicePayment" ADD CONSTRAINT "TenantInvoicePayment_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
