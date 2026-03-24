-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('APPOINTMENT', 'MEETING', 'WEBINAR', 'TRAINING', 'CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EventParticipantStatus" AS ENUM ('invited', 'confirmed', 'cancelled', 'pending');

-- AlterTable: add event_id to appointments
ALTER TABLE "appointments" ADD COLUMN "event_id" UUID;

-- CreateTable: events
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "created_by" UUID,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "event_type" "EventType" NOT NULL DEFAULT 'APPOINTMENT',
    "is_demo_data" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: event_participants
CREATE TABLE "event_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "EventParticipantStatus" NOT NULL DEFAULT 'invited',
    "response" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: event_responses
CREATE TABLE "event_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "response" TEXT NOT NULL,
    "response_status" "ResponseStatus" NOT NULL DEFAULT 'pending',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_tenant_id_idx" ON "events"("tenant_id");
CREATE INDEX "events_tenant_id_start_time_idx" ON "events"("tenant_id", "start_time");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE UNIQUE INDEX "event_participants_event_id_contact_id_key" ON "event_participants"("event_id", "contact_id");
CREATE INDEX "event_participants_event_id_idx" ON "event_participants"("event_id");
CREATE INDEX "event_participants_contact_id_idx" ON "event_participants"("contact_id");
CREATE INDEX "event_responses_event_id_idx" ON "event_responses"("event_id");
CREATE INDEX "event_responses_contact_id_idx" ON "event_responses"("contact_id");
CREATE INDEX "appointments_event_id_idx" ON "appointments"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_responses" ADD CONSTRAINT "event_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_responses" ADD CONSTRAINT "event_responses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
