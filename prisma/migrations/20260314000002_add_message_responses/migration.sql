-- Add campaign_response_received to ActivityType enum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'campaign_response_received';

-- Create ResponseStatus enum
DO $$ BEGIN
    CREATE TYPE "ResponseStatus" AS ENUM ('confirmed', 'cancelled', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create message_responses table
CREATE TABLE IF NOT EXISTS "message_responses" (
    "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"             UUID         NOT NULL,
    "contact_id"            UUID,
    "broadcast_id"          UUID         NOT NULL,
    "campaign_recipient_id" UUID,
    "response_text"         TEXT         NOT NULL,
    "response_status"       "ResponseStatus" NOT NULL DEFAULT 'pending',
    "timestamp"             TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "message_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_responses_campaign_recipient_id_key" UNIQUE ("campaign_recipient_id"),
    CONSTRAINT "message_responses_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "message_responses_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL,
    CONSTRAINT "message_responses_broadcast_id_fkey"
        FOREIGN KEY ("broadcast_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
    CONSTRAINT "message_responses_campaign_recipient_id_fkey"
        FOREIGN KEY ("campaign_recipient_id") REFERENCES "campaign_recipients"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "message_responses_tenant_id_idx"      ON "message_responses"("tenant_id");
CREATE INDEX IF NOT EXISTS "message_responses_contact_id_idx"     ON "message_responses"("contact_id");
CREATE INDEX IF NOT EXISTS "message_responses_broadcast_id_idx"   ON "message_responses"("broadcast_id");
CREATE INDEX IF NOT EXISTS "message_responses_response_status_idx" ON "message_responses"("response_status");
