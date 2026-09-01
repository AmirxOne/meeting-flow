-- Wayfinding text + optional map image on branch and floor (guest check-in guide)
ALTER TABLE "Branch" ADD COLUMN "wayfindingText" TEXT;
ALTER TABLE "Branch" ADD COLUMN "mapStorageKey" TEXT;
ALTER TABLE "Branch" ADD COLUMN "mapMimeType" TEXT;

ALTER TABLE "Floor" ADD COLUMN "wayfindingText" TEXT;
ALTER TABLE "Floor" ADD COLUMN "mapStorageKey" TEXT;
ALTER TABLE "Floor" ADD COLUMN "mapMimeType" TEXT;
