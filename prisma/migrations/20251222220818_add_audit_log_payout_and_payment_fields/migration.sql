-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('REFUND', 'PAYOUT', 'PAYMENT_CAPTURE', 'PAYMENT_VOID', 'JOB_CANCEL', 'JOB_COMPLETE', 'USER_BAN', 'USER_UNBAN', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM ('PAYMENT', 'PAYOUT', 'JOB', 'USER', 'OFFER');

-- AlterTable: Add missing fields to payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_fee" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "tip_payment_intent_id" TEXT,
ADD COLUMN IF NOT EXISTS "refund_amount" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "refund_reason" TEXT,
ADD COLUMN IF NOT EXISTS "tip_added_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "captured_at" TIMESTAMP(3);

-- CreateIndex for captured_at
CREATE INDEX IF NOT EXISTS "payments_captured_at_idx" ON "payments"("captured_at");

-- CreateTable: payouts
CREATE TABLE IF NOT EXISTS "payouts" (
    "id" TEXT NOT NULL,
    "hustler_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payout_provider_id" TEXT,
    "payout_method" TEXT NOT NULL DEFAULT 'STRIPE_TRANSFER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action_type" "AuditActionType" NOT NULL,
    "resource_type" "AuditResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payouts_hustler_id_idx" ON "payouts"("hustler_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payouts_job_id_idx" ON "payouts"("job_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payouts_completed_at_idx" ON "payouts"("completed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_action_type_idx" ON "audit_logs"("action_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_idx" ON "audit_logs"("resource_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_hustler_id_fkey" FOREIGN KEY ("hustler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

