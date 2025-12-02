-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "arrival_code" TEXT;
ALTER TABLE "jobs" ADD COLUMN "arrival_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN "completion_code" TEXT;
ALTER TABLE "jobs" ADD COLUMN "completion_verified" BOOLEAN NOT NULL DEFAULT false;

