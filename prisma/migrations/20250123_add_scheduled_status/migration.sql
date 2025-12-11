-- AlterEnum
-- Add SCHEDULED to JobStatus enum
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

