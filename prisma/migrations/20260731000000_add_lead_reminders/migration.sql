-- The legacy reminder fields were added to schema.prisma without a checked-in
-- migration. Add them defensively before moving existing values into the new
-- auditable reminder table.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reminderNote" TEXT;

DO $$
BEGIN
  CREATE TYPE "LeadReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LeadReminder" (
  "id" TEXT NOT NULL,
  "remindAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" "LeadReminderStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "leadId" TEXT NOT NULL,
  "assignedUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "completedById" TEXT,
  "tenantId" TEXT NOT NULL,
  CONSTRAINT "LeadReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadReminder_tenantId_status_remindAt_idx"
  ON "LeadReminder"("tenantId", "status", "remindAt");
CREATE INDEX IF NOT EXISTS "LeadReminder_assignedUserId_status_remindAt_idx"
  ON "LeadReminder"("assignedUserId", "status", "remindAt");
CREATE INDEX IF NOT EXISTS "LeadReminder_leadId_status_idx"
  ON "LeadReminder"("leadId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadReminder_one_pending_per_lead_idx"
  ON "LeadReminder"("leadId")
  WHERE "status" = 'PENDING';

DO $$
BEGIN
  ALTER TABLE "LeadReminder"
    ADD CONSTRAINT "LeadReminder_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadReminder"
    ADD CONSTRAINT "LeadReminder_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadReminder"
    ADD CONSTRAINT "LeadReminder_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadReminder"
    ADD CONSTRAINT "LeadReminder_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadReminder"
    ADD CONSTRAINT "LeadReminder_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Preserve reminders created by the previous feature. The lead's assigned user
-- is also the best available creator for these legacy records.
INSERT INTO "LeadReminder" (
  "id", "remindAt", "note", "status", "createdAt", "updatedAt",
  "leadId", "assignedUserId", "createdById", "tenantId"
)
SELECT
  'legacy_' || l."id",
  l."reminderDate",
  l."reminderNote",
  'PENDING'::"LeadReminderStatus",
  l."updatedAt",
  l."updatedAt",
  l."id",
  l."userId",
  l."userId",
  l."tenantId"
FROM "Lead" l
WHERE l."reminderDate" IS NOT NULL
  AND l."userId" IS NOT NULL
  AND l."status" IN ('PENDING', 'NO_ANSWER')
  AND NOT EXISTS (
    SELECT 1 FROM "LeadReminder" r
    WHERE r."leadId" = l."id" AND r."status" = 'PENDING'
  );
