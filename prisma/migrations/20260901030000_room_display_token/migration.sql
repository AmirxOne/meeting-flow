-- Kiosk / door-tablet display token (hashed) + short room code

ALTER TABLE "MeetingRoom" ADD COLUMN "displayTokenHash" TEXT;
ALTER TABLE "MeetingRoom" ADD COLUMN "displayCode" TEXT;
ALTER TABLE "MeetingRoom" ADD COLUMN "displayTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MeetingRoom_displayTokenHash_key" ON "MeetingRoom"("displayTokenHash");
CREATE UNIQUE INDEX "MeetingRoom_displayCode_key" ON "MeetingRoom"("displayCode");
