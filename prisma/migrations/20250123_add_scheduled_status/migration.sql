-- Add SCHEDULED status to JobStatus enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jobstatus') THEN
        CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'REQUESTED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM', 'PAID', 'CANCELLED', 'EXPIRED');
    ELSE
        -- Check if SCHEDULED already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'SCHEDULED' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'jobstatus')
        ) THEN
            ALTER TYPE "JobStatus" ADD VALUE 'SCHEDULED' BEFORE 'IN_PROGRESS';
        END IF;
    END IF;
END
$$;

