-- CreateTable
CREATE TABLE "MeetingCalendarSync" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "MeetingCalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCalendarSync_meetingId_provider_key" ON "MeetingCalendarSync"("meetingId", "provider");

-- CreateIndex
CREATE INDEX "MeetingCalendarSync_meetingId_idx" ON "MeetingCalendarSync"("meetingId");

-- AddForeignKey
ALTER TABLE "MeetingCalendarSync" ADD CONSTRAINT "MeetingCalendarSync_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
