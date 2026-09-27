-- AvailabilityMember: per-person schedule override (null = inherit org config)
ALTER TABLE "AvailabilityMember" ADD COLUMN "createDay" INTEGER;
ALTER TABLE "AvailabilityMember" ADD COLUMN "periodKind" TEXT;
ALTER TABLE "AvailabilityMember" ADD COLUMN "deadlineDayOffset" INTEGER;
ALTER TABLE "AvailabilityMember" ADD COLUMN "deadlineMinutes" INTEGER;
