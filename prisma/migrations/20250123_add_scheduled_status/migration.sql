-- Add SCHEDULED status to JobStatus enum
DO $$
BEGIN
    -- Check if SCHEDULED already exists before adding
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SCHEDULED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'jobstatus')
    ) THEN
        ALTER TYPE "JobStatus" ADD VALUE 'SCHEDULED';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Enum value already exists, ignore
        NULL;
END
$$;

