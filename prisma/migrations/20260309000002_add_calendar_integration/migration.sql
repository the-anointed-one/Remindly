-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR');

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID         NOT NULL,
    "provider"     "CalendarProvider" NOT NULL,
    "access_token" TEXT         NOT NULL,
    "refresh_token" TEXT        NOT NULL,
    "expires_at"   TIMESTAMP(3) NOT NULL,
    "email"        TEXT,
    "sync_status"  "CalendarSyncStatus" NOT NULL DEFAULT 'IDLE',
    "last_sync_at" TIMESTAMP(3),
    "sync_error"   TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_synced_events" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "connection_id"     UUID         NOT NULL,
    "tenant_id"         UUID         NOT NULL,
    "external_event_id" TEXT         NOT NULL,
    "appointment_id"    UUID,
    "title"             TEXT         NOT NULL,
    "start_at"          TIMESTAMP(3) NOT NULL,
    "end_at"            TIMESTAMP(3) NOT NULL,
    "attendee_email"    TEXT,
    "attendee_phone"    TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_synced_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_tenant_id_provider_key"
    ON "calendar_connections"("tenant_id", "provider");

CREATE INDEX "calendar_connections_tenant_id_idx"
    ON "calendar_connections"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_synced_events_connection_id_external_event_id_key"
    ON "calendar_synced_events"("connection_id", "external_event_id");

CREATE INDEX "calendar_synced_events_tenant_id_idx"
    ON "calendar_synced_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "calendar_connections"
    ADD CONSTRAINT "calendar_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_synced_events"
    ADD CONSTRAINT "calendar_synced_events_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
