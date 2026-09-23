-- attendance marking for external guests too
ALTER TABLE "MeetingGuest" ADD COLUMN "attendanceStatus" TEXT;
ALTER TABLE "MeetingGuest" ADD COLUMN "attendanceMarkedAt" TIMESTAMP(3);
ALTER TABLE "MeetingGuest" ADD COLUMN "attendanceMarkedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
