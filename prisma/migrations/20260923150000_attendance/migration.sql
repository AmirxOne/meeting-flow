-- organizer attendance tracking: PRESENT | LATE | ABSENT | EXCUSED (null = not marked)
ALTER TABLE "MeetingParticipant" ADD COLUMN "attendanceStatus" TEXT;
ALTER TABLE "MeetingParticipant" ADD COLUMN "attendanceMarkedAt" TIMESTAMP(3);
ALTER TABLE "MeetingParticipant" ADD COLUMN "attendanceMarkedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MeetingParticipant_attendance_idx" ON "MeetingParticipant"("attendanceStatus");
