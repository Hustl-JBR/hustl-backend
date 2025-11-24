-- Add read status to messages table
-- Migration: Add read, readAt, and readBy columns to messages

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_by" TEXT;

-- Create index on read column for faster unread count queries
CREATE INDEX IF NOT EXISTS "messages_read_idx" ON "messages"("read");

-- Update existing messages to have read = false (backfill)
UPDATE "messages" SET "read" = false WHERE "read" IS NULL;




