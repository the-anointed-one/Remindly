-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "completion_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prompt_tokens" INTEGER NOT NULL DEFAULT 0;

