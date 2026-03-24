-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "completion_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prompt_tokens" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "automation_executions_this_month" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contact_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "event_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_reset_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
