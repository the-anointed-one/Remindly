-- ────────────────────────────────────────────────────────────────────────────
-- Migration: Add Campaign Architecture
--   • Tag + ContactTag (proper many-to-many contact tagging)
--   • Campaign + AudienceSegment
--   • Appointment: make customer_id nullable, add campaign_id + audience_segment_id
--   • CampaignDispatchStatus enum
-- ────────────────────────────────────────────────────────────────────────────

-- Enum: CampaignDispatchStatus
CREATE TYPE "CampaignDispatchStatus" AS ENUM ('PENDING', 'DISPATCHING', 'COMPLETED', 'FAILED');

-- ── Tags ─────────────────────────────────────────────────────────────────────

CREATE TABLE "tags" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID         NOT NULL,
    "name"       TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "tags_tenant_id_name_key" ON "tags"("tenant_id", "name");
CREATE INDEX "tags_tenant_id_idx" ON "tags"("tenant_id");

-- ── ContactTags (join table) ──────────────────────────────────────────────────

CREATE TABLE "contact_tags" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID         NOT NULL,
    "tag_id"     UUID         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_tags_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE,
    CONSTRAINT "contact_tags_tag_id_fkey"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "contact_tags_contact_id_tag_id_key" ON "contact_tags"("contact_id", "tag_id");
CREATE INDEX "contact_tags_contact_id_idx" ON "contact_tags"("contact_id");
CREATE INDEX "contact_tags_tag_id_idx"     ON "contact_tags"("tag_id");

-- ── Campaigns ─────────────────────────────────────────────────────────────────

CREATE TABLE "campaigns" (
    "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID           NOT NULL,
    "name"        TEXT           NOT NULL,
    "description" TEXT,
    "status"      "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaigns_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns"("tenant_id");

-- ── AudienceSegments ──────────────────────────────────────────────────────────

CREATE TABLE "audience_segments" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID         NOT NULL,
    "name"        TEXT         NOT NULL,
    "tag_id"      UUID,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audience_segments_campaign_id_fkey"
        FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
    CONSTRAINT "audience_segments_tag_id_fkey"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE SET NULL
);

CREATE INDEX "audience_segments_campaign_id_idx" ON "audience_segments"("campaign_id");
CREATE INDEX "audience_segments_tag_id_idx"      ON "audience_segments"("tag_id");

-- ── Appointments: extend for campaign targeting ───────────────────────────────

-- Make customer_id nullable (existing rows all have a value; this is safe)
ALTER TABLE "appointments" ALTER COLUMN "customer_id" DROP NOT NULL;

-- Add campaign_id (nullable)
ALTER TABLE "appointments" ADD COLUMN "campaign_id"          UUID;
ALTER TABLE "appointments" ADD COLUMN "audience_segment_id"  UUID;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_campaign_id_fkey"
        FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_audience_segment_id_fkey"
        FOREIGN KEY ("audience_segment_id") REFERENCES "audience_segments"("id") ON DELETE SET NULL;

CREATE INDEX "appointments_campaign_id_idx" ON "appointments"("campaign_id");
