-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token_hash" TEXT;

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
