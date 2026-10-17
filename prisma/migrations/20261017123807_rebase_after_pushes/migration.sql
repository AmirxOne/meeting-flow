-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_branchId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingContentAcl" DROP CONSTRAINT "MeetingContentAcl_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingMinutes" DROP CONSTRAINT "MeetingMinutes_approverId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingSecretary" DROP CONSTRAINT "MeetingSecretary_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingSecretary" DROP CONSTRAINT "MeetingSecretary_userId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingTopic" DROP CONSTRAINT "MeetingTopic_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MeetingTopic" DROP CONSTRAINT "MeetingTopic_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingTopic" DROP CONSTRAINT "MeetingTopic_minutesId_fkey";

-- DropIndex
DROP INDEX "MeetingParticipant_attendance_idx";

-- DropIndex
DROP INDEX "Role_orgId_idx";

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "docTemplate" JSONB;

-- AlterTable
ALTER TABLE "MeetingAttachment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "MeetingContentAcl" ALTER COLUMN "allowedUserIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MeetingRequest" ADD COLUMN     "prefSlots" JSONB;

-- AlterTable
ALTER TABLE "MeetingTopic" ALTER COLUMN "allowedUserIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "attendanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrCheckinEnabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "displayEnabled" SET DEFAULT false;

-- CreateTable
CREATE TABLE "AppointmentProgram" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topics" JSONB,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL',
    "audienceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roomIds" TEXT[],
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "windows" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentBooking" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "AppointmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentProgram_orgId_status_idx" ON "AppointmentProgram"("orgId", "status");

-- CreateIndex
CREATE INDEX "AppointmentProgram_hostId_idx" ON "AppointmentProgram"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentBooking_meetingId_key" ON "AppointmentBooking"("meetingId");

-- CreateIndex
CREATE INDEX "AppointmentBooking_orgId_userId_idx" ON "AppointmentBooking"("orgId", "userId");

-- CreateIndex
CREATE INDEX "AppointmentBooking_programId_status_idx" ON "AppointmentBooking"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentBooking_programId_startAt_key" ON "AppointmentBooking"("programId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_publicSlug_key" ON "MeetingRoom"("publicSlug");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMinutes" ADD CONSTRAINT "MeetingMinutes_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSecretary" ADD CONSTRAINT "MeetingSecretary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSecretary" ADD CONSTRAINT "MeetingSecretary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "MeetingMinutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingContentAcl" ADD CONSTRAINT "MeetingContentAcl_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentProgram" ADD CONSTRAINT "AppointmentProgram_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentProgram" ADD CONSTRAINT "AppointmentProgram_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBooking" ADD CONSTRAINT "AppointmentBooking_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AppointmentProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBooking" ADD CONSTRAINT "AppointmentBooking_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBooking" ADD CONSTRAINT "AppointmentBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBooking" ADD CONSTRAINT "AppointmentBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

