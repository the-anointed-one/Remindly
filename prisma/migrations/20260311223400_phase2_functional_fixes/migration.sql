/*
  Warnings:

  - The primary key for the `processed_webhooks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `paystack_authorization_code` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[event_id]` on the table `processed_webhooks` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `processed_webhooks` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `password_hash` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('contact', 'tag', 'group', 'segment');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('contact_created', 'appointment_created', 'appointment_confirmed', 'appointment_deleted', 'appointment_rescheduled', 'message_sent', 'message_delivered', 'campaign_sent', 'reminder_sent', 'review_requested', 'tag_added', 'tag_removed');

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_audience_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "audience_segments" DROP CONSTRAINT "audience_segments_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "audience_segments" DROP CONSTRAINT "audience_segments_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "contact_tags" DROP CONSTRAINT "contact_tags_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "contact_tags" DROP CONSTRAINT "contact_tags_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "prediction_logs" DROP CONSTRAINT "prediction_logs_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "prediction_logs" DROP CONSTRAINT "prediction_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_tenant_id_fkey";

-- DropIndex
DROP INDEX "users_email_idx";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "risk_calculated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audience_segments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "calendar_connections" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "calendar_synced_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "campaigns" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "channel_strategies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "chain" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contact_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "unsubscribed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "failover_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feedback_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feedback_responses" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "google_business_connections" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "google_reviews" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prediction_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "generated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "processed_webhooks" DROP CONSTRAINT "processed_webhooks_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "processed_at" DROP DEFAULT,
ADD CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reactivation_campaigns" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reactivation_contacts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "referrals" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "reward_issued_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "contact_id" UUID;

-- AlterTable
ALTER TABLE "reschedule_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "paystack_authorization_code",
ALTER COLUMN "whatsapp_monthly_limit" SET DEFAULT 500;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "provider",
DROP COLUMN "provider_id",
ALTER COLUMN "password_hash" SET NOT NULL;

-- AlterTable
ALTER TABLE "widget_configs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_actions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_conditions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_executions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_triggers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflows" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "contact_id" UUID,
    "recipient" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message_body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_participants" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_targets" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_activity" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "reference_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "campaign_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_contact_id_idx" ON "campaign_recipients"("contact_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_status_idx" ON "campaign_recipients"("status");

-- CreateIndex
CREATE INDEX "appointment_participants_appointment_id_idx" ON "appointment_participants"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_participants_contact_id_idx" ON "appointment_participants"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_participants_appointment_id_contact_id_key" ON "appointment_participants"("appointment_id", "contact_id");

-- CreateIndex
CREATE INDEX "appointment_targets_appointment_id_idx" ON "appointment_targets"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_targets_target_type_target_id_idx" ON "appointment_targets"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "contact_groups_tenant_id_idx" ON "contact_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_groups_tenant_id_name_key" ON "contact_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "contact_group_members_group_id_idx" ON "contact_group_members"("group_id");

-- CreateIndex
CREATE INDEX "contact_group_members_contact_id_idx" ON "contact_group_members"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_group_members_group_id_contact_id_key" ON "contact_group_members"("group_id", "contact_id");

-- CreateIndex
CREATE INDEX "contact_activity_tenant_id_idx" ON "contact_activity"("tenant_id");

-- CreateIndex
CREATE INDEX "contact_activity_contact_id_idx" ON "contact_activity"("contact_id");

-- CreateIndex
CREATE INDEX "contact_activity_contact_id_created_at_idx" ON "contact_activity"("contact_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_event_id_key" ON "processed_webhooks"("event_id");

-- CreateIndex
CREATE INDEX "reminders_contact_id_idx" ON "reminders"("contact_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_audience_segment_id_fkey" FOREIGN KEY ("audience_segment_id") REFERENCES "audience_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_participants" ADD CONSTRAINT "appointment_participants_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_participants" ADD CONSTRAINT "appointment_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_targets" ADD CONSTRAINT "appointment_targets_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activity" ADD CONSTRAINT "contact_activity_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activity" ADD CONSTRAINT "contact_activity_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
