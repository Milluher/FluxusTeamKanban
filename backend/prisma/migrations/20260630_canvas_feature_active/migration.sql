-- Allow features to be marked inactive (struck through) instead of deleted
ALTER TABLE "CanvasFeature" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
