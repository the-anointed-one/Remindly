-- Add response tracking fields to campaign_recipients
ALTER TABLE "campaign_recipients"
  ADD COLUMN IF NOT EXISTS "response_text" TEXT,
  ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMPTZ;

-- Index for fast inbound phone lookups
CREATE INDEX IF NOT EXISTS "campaign_recipients_recipient_idx"
  ON "campaign_recipients" ("recipient");
