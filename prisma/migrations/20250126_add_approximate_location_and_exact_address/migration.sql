-- Add approximate location fields for privacy (shown before acceptance)
-- These fields store the approximate location (0.25 mile radius center point)
DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "approximate_lat" DOUBLE PRECISION;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "approximate_lng" DOUBLE PRECISION;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add exact address field (only shared after acceptance)
DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "exact_address" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add index for approximate location queries
CREATE INDEX IF NOT EXISTS "jobs_approximate_lat_approximate_lng_idx" ON "jobs"("approximate_lat", "approximate_lng");

