ALTER TABLE "MeetingRequest" ALTER COLUMN "requesterId" DROP NOT NULL;
ALTER TABLE "MeetingRequest" ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestPhone" TEXT,
ADD COLUMN "guestCompany" TEXT;