-- Org holidays / blocked calendar days
CREATE TABLE "OrgHoliday" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dateIso" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "OrgHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgHoliday_orgId_dateIso_key" ON "OrgHoliday"("orgId", "dateIso");
CREATE INDEX "OrgHoliday_orgId_dateIso_idx" ON "OrgHoliday"("orgId", "dateIso");

ALTER TABLE "OrgHoliday" ADD CONSTRAINT "OrgHoliday_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MeetingPolicy" ("id", "orgId", "key", "value", "description", "updatedAt")
SELECT
  'hbk' || substr(md5(o.id), 1, 22),
  o.id,
  'holidayBooking',
  '"BLOCK"'::jsonb,
  'رزرو در تعطیل سازمانی: ممنوع یا نیاز به تأیید',
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "MeetingPolicy" p
  WHERE p."orgId" = o.id AND p."key" = 'holidayBooking'
);
