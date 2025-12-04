-- Add start code system fields to jobs table
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "start_code" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "start_code_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "start_code_expires_at" TIMESTAMP(3);

-- Create index for expiration checking
CREATE INDEX IF NOT EXISTS "jobs_start_code_expires_at_idx" ON "jobs"("start_code_expires_at") WHERE "start_code_expires_at" IS NOT NULL AND "start_code_verified" = false;


