-- Comprehensive migration to add ALL missing columns
-- Uses safe "IF NOT EXISTS" patterns to avoid errors

-- =============================================
-- USERS TABLE - Add missing columns
-- =============================================

-- Add bio column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "bio" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add gender column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "gender" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add stripe_account_id column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "stripe_account_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add email_verified column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add email_verification_code column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "email_verification_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add email_verification_expiry column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "email_verification_expiry" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add referral_code column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "referral_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add referred_by_user_id column
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "referred_by_user_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add unique index for referral_code (safe)
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");

-- Add index for referral lookups
CREATE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_referred_by_user_id_idx" ON "users"("referred_by_user_id");

-- =============================================
-- JOBS TABLE - Add missing columns
-- =============================================

-- Add recurring job fields
DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "parent_job_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "recurrence_type" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "recurrence_end_date" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "recurrence_paused" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "next_recurrence_date" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add verification code fields
DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "arrival_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "arrival_verified" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "completion_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD COLUMN "completion_verified" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add indexes for recurring jobs
CREATE INDEX IF NOT EXISTS "jobs_parent_job_id_idx" ON "jobs"("parent_job_id");
CREATE INDEX IF NOT EXISTS "jobs_recurrence_type_idx" ON "jobs"("recurrence_type");
CREATE INDEX IF NOT EXISTS "jobs_next_recurrence_date_idx" ON "jobs"("next_recurrence_date");

-- =============================================
-- OFFERS TABLE - Add missing columns
-- =============================================

DO $$ BEGIN
    ALTER TABLE "offers" ADD COLUMN "proposed_amount" DECIMAL(10,2);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- MESSAGES TABLE - Add missing columns
-- =============================================

DO $$ BEGIN
    ALTER TABLE "messages" ADD COLUMN "read" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "messages" ADD COLUMN "read_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "messages" ADD COLUMN "read_by" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "messages_read_idx" ON "messages"("read");

-- =============================================
-- REFERRALS TABLE - Create if not exists
-- =============================================

CREATE TABLE IF NOT EXISTS "referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "reward_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reward_status" TEXT NOT NULL DEFAULT 'PENDING',
    "referred_user_completed_job" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewarded_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_user_id_key" ON "referrals"("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_referrer_id_idx" ON "referrals"("referrer_id");
CREATE INDEX IF NOT EXISTS "referrals_referred_user_id_idx" ON "referrals"("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_reward_status_idx" ON "referrals"("reward_status");

-- =============================================
-- LOCATION_UPDATES TABLE - Create if not exists
-- =============================================

CREATE TABLE IF NOT EXISTS "location_updates" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "hustler_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "location_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "location_updates_job_id_idx" ON "location_updates"("job_id");
CREATE INDEX IF NOT EXISTS "location_updates_hustler_id_idx" ON "location_updates"("hustler_id");
CREATE INDEX IF NOT EXISTS "location_updates_timestamp_idx" ON "location_updates"("timestamp");

-- =============================================
-- Add EXPIRED to JobStatus enum if not exists
-- =============================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'EXPIRED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')
    ) THEN
        ALTER TYPE "JobStatus" ADD VALUE 'EXPIRED';
    END IF;
END $$;

-- =============================================
-- Add foreign keys (safe - ignore if exists)
-- =============================================

DO $$ BEGIN
    ALTER TABLE "location_updates" ADD CONSTRAINT "location_updates_job_id_fkey" 
        FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "location_updates" ADD CONSTRAINT "location_updates_hustler_id_fkey" 
        FOREIGN KEY ("hustler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" 
        FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" 
        FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_job_id_fkey" 
        FOREIGN KEY ("parent_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_fkey" 
        FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;




