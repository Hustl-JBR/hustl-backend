-- Add EXPIRED status to JobStatus enum
-- Note: PostgreSQL requires enum values to be committed before use
-- The UPDATE to mark old jobs as EXPIRED will be done by the cleanup service

-- First, check if EXPIRED value exists and add it if not
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

-- NOTE: Cannot UPDATE jobs to EXPIRED in same transaction
-- The cleanup service handles marking old jobs as EXPIRED
