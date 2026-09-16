ALTER TABLE "MeetingRequest" ADD COLUMN "venue" TEXT NOT NULL DEFAULT 'ONSITE';
ALTER TABLE "MeetingRequest" ADD COLUMN "offsiteOrg" TEXT;
ALTER TABLE "MeetingRequest" ADD COLUMN "offsiteNote" TEXT;