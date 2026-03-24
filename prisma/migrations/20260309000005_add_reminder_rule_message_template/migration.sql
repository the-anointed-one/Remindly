ALTER TABLE "reminder_rules"
    ADD COLUMN IF NOT EXISTS "message_template" TEXT;
