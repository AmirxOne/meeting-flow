-- Per-user Google Calendar OAuth + sync rows scoped to a user

CREATE TABLE "UserCalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "refreshTokenEnc" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accountEmail" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCalendarConnection_userId_provider_key" ON "UserCalendarConnection"("userId", "provider");
CREATE INDEX "UserCalendarConnection_userId_idx" ON "UserCalendarConnection"("userId");

ALTER TABLE "UserCalendarConnection" ADD CONSTRAINT "UserCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingCalendarSync" ADD COLUMN "userId" TEXT;

UPDATE "MeetingCalendarSync" AS s
SET "userId" = m."organizerId"
FROM "Meeting" AS m
WHERE m."id" = s."meetingId" AND s."userId" IS NULL;

DELETE FROM "MeetingCalendarSync" WHERE "userId" IS NULL;

ALTER TABLE "MeetingCalendarSync" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "MeetingCalendarSync_meetingId_provider_key";

CREATE UNIQUE INDEX "MeetingCalendarSync_meetingId_userId_provider_key" ON "MeetingCalendarSync"("meetingId", "userId", "provider");
CREATE INDEX "MeetingCalendarSync_userId_idx" ON "MeetingCalendarSync"("userId");

ALTER TABLE "MeetingCalendarSync" ADD CONSTRAINT "MeetingCalendarSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
