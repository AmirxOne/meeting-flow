-- Optional video conference link on meetings and series

ALTER TABLE "Meeting" ADD COLUMN "videoProvider" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "videoUrl" TEXT;

ALTER TABLE "MeetingSeries" ADD COLUMN "videoProvider" TEXT;
ALTER TABLE "MeetingSeries" ADD COLUMN "videoUrl" TEXT;
