CREATE TABLE "failover_logs" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID        NOT NULL,
    "reminder_id"  UUID,
    "from_channel" "ChannelType" NOT NULL,
    "to_channel"   "ChannelType" NOT NULL,
    "reason"       TEXT        NOT NULL,
    "success"      BOOLEAN     NOT NULL DEFAULT false,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "failover_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "failover_logs_tenant_id_idx" ON "failover_logs"("tenant_id");

ALTER TABLE "failover_logs"
    ADD CONSTRAINT "failover_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "failover_logs"
    ADD CONSTRAINT "failover_logs_reminder_id_fkey"
    FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
