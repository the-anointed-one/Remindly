-- Add risk score fields to appointments
ALTER TABLE "appointments"
    ADD COLUMN IF NOT EXISTS "no_show_risk_score" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "risk_calculated_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "appointments_no_show_risk_score_idx" ON "appointments"("no_show_risk_score");

-- Create prediction_logs table
CREATE TABLE "prediction_logs" (
    "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"            UUID        NOT NULL,
    "appointment_id"       UUID        NOT NULL,
    "customer_id"          UUID        NOT NULL,
    "risk_score"           DOUBLE PRECISION NOT NULL,
    "risk_level"           TEXT        NOT NULL,
    "signals"              JSONB       NOT NULL DEFAULT '{}',
    "escalation_triggered" BOOLEAN     NOT NULL DEFAULT false,
    "escalation_channels"  TEXT[]      NOT NULL DEFAULT '{}',
    "generated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "prediction_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prediction_logs_tenant_id_idx"      ON "prediction_logs"("tenant_id");
CREATE INDEX "prediction_logs_appointment_id_idx" ON "prediction_logs"("appointment_id");
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;
