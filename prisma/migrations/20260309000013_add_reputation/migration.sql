-- CreateTable
CREATE TABLE "feedback_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL DEFAULT 'SMS',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "sentiment" TEXT NOT NULL,
    "review_link_sent" BOOLEAN NOT NULL DEFAULT false,
    "private_form_sent" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_requests_tenant_id_idx" ON "feedback_requests"("tenant_id");
CREATE INDEX "feedback_requests_phone_idx" ON "feedback_requests"("phone");
CREATE INDEX "feedback_responses_tenant_id_idx" ON "feedback_responses"("tenant_id");

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
