-- Workflows
CREATE TABLE "workflows" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID        NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN     NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflows_tenant_id_idx" ON "workflows"("tenant_id");
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workflow Triggers
CREATE TABLE "workflow_triggers" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID        NOT NULL,
    "type"        TEXT        NOT NULL,
    "config"      JSONB       NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_triggers_workflow_id_key" ON "workflow_triggers"("workflow_id");
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workflow Actions
CREATE TABLE "workflow_actions" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id"  UUID        NOT NULL,
    "step_order"   INTEGER     NOT NULL,
    "type"         TEXT        NOT NULL,
    "config"       JSONB       NOT NULL DEFAULT '{}',
    "delay_minutes" INTEGER    NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflow_actions_workflow_id_step_order_idx" ON "workflow_actions"("workflow_id", "step_order");
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workflow Conditions
CREATE TABLE "workflow_conditions" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id"    UUID        NOT NULL,
    "action_id"      UUID,
    "condition_type" TEXT        NOT NULL,
    "operator"       TEXT        NOT NULL DEFAULT 'equals',
    "value"          TEXT        NOT NULL,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workflow_conditions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflow_conditions_workflow_id_idx" ON "workflow_conditions"("workflow_id");
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_action_id_fkey"
    FOREIGN KEY ("action_id") REFERENCES "workflow_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workflow Executions
CREATE TABLE "workflow_executions" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id"      UUID        NOT NULL,
    "tenant_id"        UUID        NOT NULL,
    "trigger_type"     TEXT        NOT NULL,
    "trigger_entity_id" TEXT       NOT NULL,
    "status"           TEXT        NOT NULL DEFAULT 'RUNNING',
    "actions_run"      INTEGER     NOT NULL DEFAULT 0,
    "actions_skipped"  INTEGER     NOT NULL DEFAULT 0,
    "error"            TEXT,
    "started_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completed_at"     TIMESTAMPTZ,
    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");
CREATE INDEX "workflow_executions_tenant_id_idx"   ON "workflow_executions"("tenant_id");
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
