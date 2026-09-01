-- Optional waitlist: WAITLISTED meetings do not lock the room until claimed
ALTER TABLE "Meeting" ADD COLUMN "waitlistQueuedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "waitlistOfferedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "waitlistOfferExpiresAt" TIMESTAMP(3);

CREATE INDEX "Meeting_roomId_status_startAt_idx" ON "Meeting"("roomId", "status", "startAt");
