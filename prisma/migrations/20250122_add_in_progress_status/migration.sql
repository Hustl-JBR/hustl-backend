-- AlterEnum
-- Add IN_PROGRESS to JobStatus enum
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

