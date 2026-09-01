-- Recurring meeting series (parent) + instance columns on Meeting

CREATE TABLE "MeetingSeries" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "freq" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "until" TIMESTAMP(3),
    "count" INTEGER,
    "durationMin" INTEGER NOT NULL,
    "dtstart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Meeting" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "originalStartAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "isException" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MeetingSeries_organizerId_idx" ON "MeetingSeries"("organizerId");
CREATE INDEX "MeetingSeries_branchId_idx" ON "MeetingSeries"("branchId");
CREATE INDEX "Meeting_seriesId_originalStartAt_idx" ON "Meeting"("seriesId", "originalStartAt");

ALTER TABLE "MeetingSeries" ADD CONSTRAINT "MeetingSeries_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingSeries" ADD CONSTRAINT "MeetingSeries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingSeries" ADD CONSTRAINT "MeetingSeries_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MeetingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "MeetingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
