-- Personal calendar ICS subscribe token (hashed, revocable)

ALTER TABLE "User" ADD COLUMN "calendarFeedTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "calendarFeedCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_calendarFeedTokenHash_key" ON "User"("calendarFeedTokenHash");
