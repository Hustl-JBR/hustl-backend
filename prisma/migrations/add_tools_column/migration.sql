-- Add tools column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tools'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "tools" TEXT;
        RAISE NOTICE 'Added tools column to users table';
    ELSE
        RAISE NOTICE 'Tools column already exists in users table';
    END IF;
END $$;

