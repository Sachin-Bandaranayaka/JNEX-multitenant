-- Email one-time codes (passwordless sign-in + password reset) and the
-- password-change stamp that invalidates sessions minted before a reset.
--
-- Additive: passwordChangedAt is NULL for every existing user, which the
-- session check reads as "nothing to invalidate", so live sessions survive
-- this migration.

-- CreateEnum
CREATE TYPE "AuthCodePurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthCode_email_purpose_createdAt_idx" ON "AuthCode"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthCode_expiresAt_idx" ON "AuthCode"("expiresAt");
