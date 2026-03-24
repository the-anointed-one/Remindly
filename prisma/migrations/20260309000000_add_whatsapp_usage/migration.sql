-- AddColumn: whatsapp_usage_count and whatsapp_monthly_limit to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "whatsapp_usage_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "whatsapp_monthly_limit" INTEGER NOT NULL DEFAULT 500;
