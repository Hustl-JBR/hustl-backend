-- Add email verification fields to users table
-- Migration: Add emailVerified, emailVerificationCode, and emailVerificationExpiry columns

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expiry" TIMESTAMP(3);

-- Create index on email_verified for faster queries
CREATE INDEX IF NOT EXISTS "users_email_verified_idx" ON "users"("email_verified");

-- Backfill: Set all existing users as email verified (since they're already using the app)
UPDATE "users" SET "email_verified" = true WHERE "email_verified" IS NULL;

