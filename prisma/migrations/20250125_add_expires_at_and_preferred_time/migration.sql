-- Add expires_at column to jobs table
-- This stores the UTC timestamp when the job expires
DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "expires_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add index for expires_at to improve query performance
CREATE INDEX IF NOT EXISTS "jobs_expires_at_idx" ON "jobs"("expires_at");

-- Migrate existing expiresAt from requirements JSON to expires_at column
-- This backfills existing jobs that have expiresAt in requirements
UPDATE "jobs"
SET "expires_at" = (
    CASE 
        WHEN (requirements->>'expiresAt') IS NOT NULL 
        THEN (requirements->>'expiresAt')::timestamp
        ELSE NULL
    END
)
WHERE "expires_at" IS NULL 
  AND requirements->>'expiresAt' IS NOT NULL;

-- For jobs without expiresAt, set default to 3 days from creation
UPDATE "jobs"
SET "expires_at" = "created_at" + INTERVAL '3 days'
WHERE "expires_at" IS NULL 
  AND "status" = 'OPEN';

