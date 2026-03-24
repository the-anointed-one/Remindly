-- Add targeting fields to ReminderRule
ALTER TABLE "reminder_rules" ADD COLUMN "target_type" TEXT;
ALTER TABLE "reminder_rules" ADD COLUMN "target_id" TEXT;

-- Create index for efficient targeting queries
CREATE INDEX "reminder_rules_target_idx" ON "reminder_rules"("target_type", "target_id");

-- Comment: target_type can be 'contact', 'tag', 'group', 'segment', 'campaign', or NULL (applies to all)
-- target_id is the ID of the target entity when target_type is set