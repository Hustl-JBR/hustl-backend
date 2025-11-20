-- Add EXPIRED status to JobStatus enum
-- This migration adds the EXPIRED status to the JobStatus enum type

-- First, we need to alter the enum type
-- Note: PostgreSQL doesn't support IF NOT EXISTS for enum values, so we'll use a different approach
DO $$ 
BEGIN
    -- Check if EXPIRED value exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'EXPIRED' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'JobStatus'
        )
    ) THEN
        -- Add EXPIRED to the enum
        ALTER TYPE "JobStatus" ADD VALUE 'EXPIRED';
    END IF;
END $$;

-- Update any existing jobs that should be expired
-- Jobs older than 72 hours with status OPEN and no accepted offers should be marked as EXPIRED
UPDATE "jobs"
SET "status" = 'EXPIRED'
WHERE "status" = 'OPEN'
  AND "created_at" < NOW() - INTERVAL '72 hours'
  AND NOT EXISTS (
    SELECT 1 
    FROM "offers" 
    WHERE "offers"."job_id" = "jobs"."id" 
    AND "offers"."status" = 'ACCEPTED'
  );

