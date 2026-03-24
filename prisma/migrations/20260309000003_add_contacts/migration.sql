-- CreateTable
CREATE TABLE "contacts" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"        UUID         NOT NULL,
    "name"             TEXT         NOT NULL,
    "phone"            TEXT,
    "email"            TEXT,
    "tags"             TEXT[]       NOT NULL DEFAULT '{}',
    "notes"            TEXT,
    "unsubscribed"     BOOLEAN      NOT NULL DEFAULT false,
    "last_appointment" TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");
CREATE INDEX "contacts_tenant_id_unsubscribed_idx" ON "contacts"("tenant_id", "unsubscribed");

-- AddForeignKey
ALTER TABLE "contacts"
    ADD CONSTRAINT "contacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
