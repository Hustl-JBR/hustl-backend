-- Add SCHEDULED status to JobStatus enum
DO $$
BEGIN
    -- Check if SCHEDULED already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SCHEDULED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'jobstatus')
    ) THEN
        ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
    END IF;
END
$$;

