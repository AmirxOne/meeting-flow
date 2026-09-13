-- Minutes: summary + workflow
ALTER TABLE "MeetingMinutes" ADD COLUMN "summary" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "approverId" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "MeetingMinutes" ADD CONSTRAINT "MeetingMinutes_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Secretaries
CREATE TABLE "MeetingSecretary" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingSecretary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MeetingSecretary_meetingId_userId_key" ON "MeetingSecretary"("meetingId","userId");
ALTER TABLE "MeetingSecretary" ADD CONSTRAINT "MeetingSecretary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE;
ALTER TABLE "MeetingSecretary" ADD CONSTRAINT "MeetingSecretary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Topics (raised subjects)
CREATE TABLE "MeetingTopic" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "agendaItemId" TEXT,
  "title" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'COVERED',
  "notes" TEXT,
  "decisions" TEXT,
  "actions" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visibility" TEXT NOT NULL DEFAULT 'OPEN',
  "allowedUserIds" TEXT[],
  "createdById" TEXT NOT NULL,
  "minutesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingTopic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MeetingTopic_meetingId_sortOrder_idx" ON "MeetingTopic"("meetingId","sortOrder");
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE;
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "MeetingMinutes"("id") ON DELETE SET NULL;

-- Section-level confidentiality
CREATE TABLE "MeetingContentAcl" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'ALL_PARTICIPANTS',
  "allowedUserIds" TEXT[],
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingContentAcl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MeetingContentAcl_meetingId_section_key" ON "MeetingContentAcl"("meetingId","section");
ALTER TABLE "MeetingContentAcl" ADD CONSTRAINT "MeetingContentAcl_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE;
