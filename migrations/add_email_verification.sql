-- Migration: Add email verification fields to users table
-- Run this migration to add email verification support

-- Add email verification fields (if they don't exist)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(email_verification_code) WHERE email_verification_code IS NOT NULL;

-- Set all existing users to verified (so they don't get blocked)
UPDATE users SET email_verified = true WHERE email_verified IS NULL;

