-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "contact_limit" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "event_limit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "workflow_limit" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "workflow_executions" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "is_demo_data" BOOLEAN NOT NULL DEFAULT false;
