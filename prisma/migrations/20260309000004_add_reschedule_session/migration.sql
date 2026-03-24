-- CreateTable
CREATE TABLE "reschedule_sessions" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"      UUID         NOT NULL,
    "appointment_id" UUID         NOT NULL,
    "phone"          TEXT         NOT NULL,
    "channel"        "ChannelType" NOT NULL DEFAULT 'SMS',
    "offered_slots"  JSONB        NOT NULL,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reschedule_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reschedule_sessions_phone_idx" ON "reschedule_sessions"("phone");
CREATE INDEX "reschedule_sessions_expires_at_idx" ON "reschedule_sessions"("expires_at");
