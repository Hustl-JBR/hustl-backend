-- Add SCHEDULED status to JobStatus enum
DO $$ 
BEGIN
    -- Check if SCHEDULED value exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'SCHEDULED' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'JobStatus'
        )
    ) THEN
        -- Add SCHEDULED to the enum
        ALTER TYPE "JobStatus" ADD VALUE 'SCHEDULED';
    END IF;
END $$;

