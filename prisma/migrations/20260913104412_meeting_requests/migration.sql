-- CreateTable
CREATE TABLE "MeetingRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "prefFrom" TIMESTAMP(3),
    "prefTo" TIMESTAMP(3),
    "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guests" JSONB,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "meetingId" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingRequest_orgId_status_idx" ON "MeetingRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "MeetingRequest_requesterId_idx" ON "MeetingRequest"("requesterId");

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
