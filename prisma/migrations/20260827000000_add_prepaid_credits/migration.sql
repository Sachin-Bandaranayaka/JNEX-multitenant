-- Prepaid credits.
--
-- Entirely additive: every existing tenant lands on billingMode = 'POSTPAID',
-- which is the behaviour they already have, so this migration changes nothing
-- until a super admin deliberately moves a tenant to PREPAID.

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('POSTPAID', 'PREPAID');

-- CreateEnum
CREATE TYPE "CreditTxType" AS ENUM ('TOPUP', 'HOLD', 'RELEASE', 'CAPTURE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "Tenant"
  ADD COLUMN "billingMode" "BillingMode" NOT NULL DEFAULT 'POSTPAID',
  ADD COLUMN "creditLimitCredits" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "minimumShipCredits" DECIMAL(14,4),
  ADD COLUMN "lowBalanceCredits" DECIMAL(14,4),
  ADD COLUMN "lowBalanceNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CreditPrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "minimumPurchaseCredits" DECIMAL(14,4) NOT NULL DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTopUp" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "credits" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "creditPriceId" TEXT,
    "bankReceiptNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "transferTime" TIMESTAMP(3) NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "creditedCredits" DECIMAL(14,4),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "CreditTxType" NOT NULL,
    "credits" DECIMAL(14,4) NOT NULL,
    "creditsAfter" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "creditPriceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "orderId" TEXT,
    "chargeId" TEXT,
    "topUpId" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditPrice_tenantId_effectiveFrom_idx" ON "CreditPrice"("tenantId", "effectiveFrom");
CREATE INDEX "CreditPrice_tenantId_effectiveTo_idx" ON "CreditPrice"("tenantId", "effectiveTo");
CREATE INDEX "CreditTopUp_tenantId_status_idx" ON "CreditTopUp"("tenantId", "status");
CREATE INDEX "CreditTopUp_status_createdAt_idx" ON "CreditTopUp"("status", "createdAt");
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_tenantId_seq_idx" ON "CreditTransaction"("tenantId", "seq");
CREATE INDEX "CreditTransaction_tenantId_createdAt_idx" ON "CreditTransaction"("tenantId", "createdAt");
CREATE INDEX "CreditTransaction_tenantId_type_idx" ON "CreditTransaction"("tenantId", "type");
CREATE INDEX "CreditTransaction_orderId_idx" ON "CreditTransaction"("orderId");
CREATE INDEX "CreditTransaction_chargeId_idx" ON "CreditTransaction"("chargeId");
CREATE INDEX "CreditTransaction_topUpId_idx" ON "CreditTransaction"("topUpId");

-- AddForeignKey
ALTER TABLE "CreditPrice" ADD CONSTRAINT "CreditPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_creditPriceId_fkey" FOREIGN KEY ("creditPriceId") REFERENCES "CreditPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_creditPriceId_fkey" FOREIGN KEY ("creditPriceId") REFERENCES "CreditPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "DeliveryCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "CreditTopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
