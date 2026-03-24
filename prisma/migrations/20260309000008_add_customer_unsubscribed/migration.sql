ALTER TABLE "customers"
    ADD COLUMN IF NOT EXISTS "unsubscribed"    BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "unsubscribed_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "customers_tenant_id_phone_idx"
    ON "customers"("tenant_id", "phone");
