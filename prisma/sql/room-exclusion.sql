-- Database-level double-booking protection.
-- Prisma maps DateTime to timestamp(3) (no tz) — all instants stored as UTC
-- wall-clock — so use tsrange (immutable on timestamp inputs).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Meeting" DROP CONSTRAINT IF EXISTS "Meeting_room_no_overlap";

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_room_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("roomId" IS NOT NULL AND "status" IN
    ('PENDING_APPROVAL','APPROVED','CONFIRMED','RESCHEDULED','IN_PROGRESS'));
