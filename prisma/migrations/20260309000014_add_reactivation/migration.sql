-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "reactivation_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inactivity_days" INTEGER NOT NULL DEFAULT 60,
    "discount_offer" TEXT,
    "message_template" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL DEFAULT 'SMS',
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_run_at" TIMESTAMP(3),
    "total_contacted" INTEGER NOT NULL DEFAULT 0,
    "total_responded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reactivation_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactivation_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "reactivation_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reactivation_contacts_campaign_id_customer_id_key" ON "reactivation_contacts"("campaign_id", "customer_id");
CREATE INDEX "reactivation_campaigns_tenant_id_idx" ON "reactivation_campaigns"("tenant_id");
CREATE INDEX "reactivation_contacts_tenant_id_idx" ON "reactivation_contacts"("tenant_id");

-- AddForeignKey
ALTER TABLE "reactivation_campaigns" ADD CONSTRAINT "reactivation_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactivation_contacts" ADD CONSTRAINT "reactivation_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactivation_contacts" ADD CONSTRAINT "reactivation_contacts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reactivation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
