-- CreateEnum
CREATE TYPE "ImpersonationMode" AS ENUM ('READ_ONLY');

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "mode" "ImpersonationMode" NOT NULL DEFAULT 'READ_ONLY',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "impersonationSessionId" TEXT,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImpersonationSession_actorId_startedAt_idx" ON "ImpersonationSession"("actorId", "startedAt");
CREATE INDEX "ImpersonationSession_tenantId_startedAt_idx" ON "ImpersonationSession"("tenantId", "startedAt");
CREATE INDEX "ImpersonationSession_expiresAt_endedAt_idx" ON "ImpersonationSession"("expiresAt", "endedAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");
CREATE INDEX "AuditEvent_impersonationSessionId_createdAt_idx" ON "AuditEvent"("impersonationSessionId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_impersonationSessionId_fkey" FOREIGN KEY ("impersonationSessionId") REFERENCES "ImpersonationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
