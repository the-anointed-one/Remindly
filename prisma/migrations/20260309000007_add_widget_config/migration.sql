CREATE TABLE "widget_configs" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"            UUID         NOT NULL,
    "business_name"        TEXT         NOT NULL,
    "welcome_message"      TEXT,
    "services"             JSONB        NOT NULL DEFAULT '[]',
    "accent_color"         TEXT         NOT NULL DEFAULT '#6366f1',
    "working_days"         INTEGER[]    NOT NULL DEFAULT '{1,2,3,4,5}',
    "working_hours_start"  TEXT         NOT NULL DEFAULT '09:00',
    "working_hours_end"    TEXT         NOT NULL DEFAULT '17:00',
    "slot_duration"        INTEGER      NOT NULL DEFAULT 60,
    "is_active"            BOOLEAN      NOT NULL DEFAULT true,
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "widget_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "widget_configs_tenant_id_key" ON "widget_configs"("tenant_id");

ALTER TABLE "widget_configs"
    ADD CONSTRAINT "widget_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
