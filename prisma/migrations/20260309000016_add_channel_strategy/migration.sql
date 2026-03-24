-- CreateTable: channel_strategies
CREATE TABLE "channel_strategies" (
    "id"                      UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"               UUID NOT NULL,
    "name"                    VARCHAR(120) NOT NULL,
    "chain"                   "ChannelType"[] NOT NULL DEFAULT ARRAY[]::"ChannelType"[],
    "fallback_on_failed"      BOOLEAN NOT NULL DEFAULT true,
    "fallback_on_undelivered" BOOLEAN NOT NULL DEFAULT true,
    "fallback_on_unread"      BOOLEAN NOT NULL DEFAULT false,
    "unread_window_minutes"   INTEGER NOT NULL DEFAULT 30,
    "is_default"              BOOLEAN NOT NULL DEFAULT false,
    "is_active"               BOOLEAN NOT NULL DEFAULT true,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_strategies_tenant_id_idx" ON "channel_strategies"("tenant_id");

-- AddForeignKey
ALTER TABLE "channel_strategies" ADD CONSTRAINT "channel_strategies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add channel_strategy_id to reminder_rules
ALTER TABLE "reminder_rules" ADD COLUMN "channel_strategy_id" UUID;

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_channel_strategy_id_fkey"
    FOREIGN KEY ("channel_strategy_id") REFERENCES "channel_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
