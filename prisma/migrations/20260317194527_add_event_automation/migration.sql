/*
  Warnings:

  - The `target_id` column on the `reminder_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[tenant_id,email]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,phone]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'event_created';
ALTER TYPE "ActivityType" ADD VALUE 'event_updated';
ALTER TYPE "ActivityType" ADD VALUE 'event_completed';
ALTER TYPE "ActivityType" ADD VALUE 'participant_invited';
ALTER TYPE "ActivityType" ADD VALUE 'participant_confirmed';
ALTER TYPE "ActivityType" ADD VALUE 'participant_cancelled';

-- DropForeignKey
ALTER TABLE "message_responses" DROP CONSTRAINT "message_responses_broadcast_id_fkey";

-- DropForeignKey
ALTER TABLE "message_responses" DROP CONSTRAINT "message_responses_campaign_recipient_id_fkey";

-- DropForeignKey
ALTER TABLE "message_responses" DROP CONSTRAINT "message_responses_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "message_responses" DROP CONSTRAINT "message_responses_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "rsvp_events" DROP CONSTRAINT "fk_rsvp_events_contact";

-- DropForeignKey
ALTER TABLE "rsvp_events" DROP CONSTRAINT "fk_rsvp_events_event";

-- DropForeignKey
ALTER TABLE "rsvp_events" DROP CONSTRAINT "fk_rsvp_events_tenant";

-- AlterTable
ALTER TABLE "calendar_synced_events" ADD COLUMN     "event_id" UUID;

-- AlterTable
ALTER TABLE "campaign_recipients" ALTER COLUMN "responded_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_participants" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "last_response_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_responses" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feedback_requests" ADD COLUMN     "event_id" UUID,
ALTER COLUMN "appointment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "event_id" UUID;

-- AlterTable
ALTER TABLE "message_responses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prediction_logs" ADD COLUMN     "event_id" UUID,
ALTER COLUMN "appointment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reminder_rules" DROP COLUMN "target_id",
ADD COLUMN     "target_id" UUID;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "event_id" UUID,
ALTER COLUMN "appointment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rsvp_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_automations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "remind_non_responders" BOOLEAN NOT NULL DEFAULT true,
    "send_location_on_confirm" BOOLEAN NOT NULL DEFAULT true,
    "send_followup_after" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_automations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_automations_event_id_key" ON "event_automations"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_email_key" ON "contacts"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_phone_key" ON "contacts"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "message_logs_event_id_idx" ON "message_logs"("event_id");

-- CreateIndex
CREATE INDEX "message_logs_contact_id_idx" ON "message_logs"("contact_id");

-- CreateIndex
CREATE INDEX "reminder_rules_target_idx" ON "reminder_rules"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_synced_events" ADD CONSTRAINT "calendar_synced_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_responses" ADD CONSTRAINT "message_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_responses" ADD CONSTRAINT "message_responses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_responses" ADD CONSTRAINT "message_responses_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_responses" ADD CONSTRAINT "message_responses_campaign_recipient_id_fkey" FOREIGN KEY ("campaign_recipient_id") REFERENCES "campaign_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_events" ADD CONSTRAINT "rsvp_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_events" ADD CONSTRAINT "rsvp_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_events" ADD CONSTRAINT "rsvp_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_automations" ADD CONSTRAINT "event_automations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_automations" ADD CONSTRAINT "event_automations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_rsvp_events_contact_id" RENAME TO "rsvp_events_contact_id_idx";

-- RenameIndex
ALTER INDEX "idx_rsvp_events_event_id" RENAME TO "rsvp_events_event_id_idx";
