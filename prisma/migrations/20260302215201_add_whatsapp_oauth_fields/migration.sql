-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "paystack_authorization_code" TEXT,
ADD COLUMN     "whatsapp_monthly_limit" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "whatsapp_usage_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "provider_id" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;
