CREATE TABLE "locations" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID        NOT NULL,
    "name"       TEXT        NOT NULL,
    "address"    TEXT,
    "timezone"   TEXT        NOT NULL DEFAULT 'UTC',
    "phone"      TEXT,
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "locations_tenant_id_idx" ON "locations"("tenant_id");

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add location_id FK to appointments (nullable — existing rows keep NULL)
ALTER TABLE "appointments"
    ADD COLUMN IF NOT EXISTS "location_id" UUID;

CREATE INDEX "appointments_tenant_id_location_id_idx"
    ON "appointments"("tenant_id", "location_id");

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
