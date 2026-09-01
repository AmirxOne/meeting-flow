-- Real multi-tenancy: slug on Organization, orgId on tenant-owned rows.
-- Existing seed org (org-main / «شرکت نمونه») is preserved as slug "sample".

-- Organization.slug
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;
UPDATE "Organization" SET "slug" = 'sample' WHERE "id" = 'org-main';
UPDATE "Organization" SET "slug" = 'org-' || substr(replace("id", '-', ''), 1, 12)
  WHERE "slug" IS NULL;
ALTER TABLE "Organization" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- User.orgId (platform SUPER_ADMIN stays NULL)
ALTER TABLE "User" ADD COLUMN "orgId" TEXT;
UPDATE "User" SET "orgId" = COALESCE(
  (SELECT "id" FROM "Organization" WHERE "id" = 'org-main'),
  (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
);
UPDATE "User" SET "orgId" = NULL WHERE "email" = 'superadmin@example.com';
CREATE INDEX "User_orgId_idx" ON "User"("orgId");
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Session.orgId
ALTER TABLE "Session" ADD COLUMN "orgId" TEXT;
UPDATE "Session" s SET "orgId" = u."orgId" FROM "User" u WHERE s."userId" = u."id";
CREATE INDEX "Session_orgId_idx" ON "Session"("orgId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MeetingRoom.orgId
ALTER TABLE "MeetingRoom" ADD COLUMN "orgId" TEXT;
UPDATE "MeetingRoom" r SET "orgId" = b."orgId" FROM "Branch" b WHERE r."branchId" = b."id";
ALTER TABLE "MeetingRoom" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "MeetingRoom_orgId_idx" ON "MeetingRoom"("orgId");
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Meeting.orgId
ALTER TABLE "Meeting" ADD COLUMN "orgId" TEXT;
UPDATE "Meeting" m SET "orgId" = b."orgId" FROM "Branch" b WHERE m."branchId" = b."id";
ALTER TABLE "Meeting" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Meeting_orgId_idx" ON "Meeting"("orgId");
CREATE INDEX "Meeting_orgId_startAt_idx" ON "Meeting"("orgId", "startAt");
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MeetingSeries.orgId
ALTER TABLE "MeetingSeries" ADD COLUMN "orgId" TEXT;
UPDATE "MeetingSeries" s SET "orgId" = b."orgId" FROM "Branch" b WHERE s."branchId" = b."id";
ALTER TABLE "MeetingSeries" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "MeetingSeries_orgId_idx" ON "MeetingSeries"("orgId");
ALTER TABLE "MeetingSeries" ADD CONSTRAINT "MeetingSeries_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PersonDirectory.orgId
ALTER TABLE "PersonDirectory" ADD COLUMN "orgId" TEXT;
UPDATE "PersonDirectory" SET "orgId" = COALESCE(
  (SELECT "id" FROM "Organization" WHERE "id" = 'org-main'),
  (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
);
ALTER TABLE "PersonDirectory" ALTER COLUMN "orgId" SET NOT NULL;
DROP INDEX IF EXISTS "PersonDirectory_name_company_key";
CREATE UNIQUE INDEX "PersonDirectory_orgId_name_company_key"
  ON "PersonDirectory"("orgId", "name", "company");
CREATE INDEX "PersonDirectory_orgId_idx" ON "PersonDirectory"("orgId");
ALTER TABLE "PersonDirectory" ADD CONSTRAINT "PersonDirectory_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification.orgId
ALTER TABLE "Notification" ADD COLUMN "orgId" TEXT;
UPDATE "Notification" n SET "orgId" = u."orgId" FROM "User" u WHERE n."userId" = u."id";
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog.orgId
ALTER TABLE "AuditLog" ADD COLUMN "orgId" TEXT;
UPDATE "AuditLog" a SET "orgId" = u."orgId" FROM "User" u WHERE a."actorId" = u."id";
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
