-- CreateEnum: ReviewReplyStatus
CREATE TYPE "ReviewReplyStatus" AS ENUM ('PENDING', 'SUGGESTED', 'APPROVED', 'SKIPPED');

-- CreateTable: google_business_connections
CREATE TABLE "google_business_connections" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID NOT NULL,
    "google_account_id" TEXT NOT NULL,
    "location_id"       TEXT NOT NULL,
    "location_name"     TEXT,
    "access_token"      TEXT NOT NULL,
    "refresh_token"     TEXT NOT NULL,
    "token_expires_at"  TIMESTAMP(3) NOT NULL,
    "connected_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_business_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: google_reviews
CREATE TABLE "google_reviews" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID NOT NULL,
    "connection_id"       UUID NOT NULL,
    "google_review_id"    TEXT NOT NULL,
    "reviewer_name"       TEXT NOT NULL,
    "reviewer_photo_url"  TEXT,
    "rating"              INTEGER NOT NULL,
    "comment"             TEXT,
    "reviewed_at"         TIMESTAMP(3) NOT NULL,
    "ai_suggestion"       TEXT,
    "draft_reply"         TEXT,
    "status"              "ReviewReplyStatus" NOT NULL DEFAULT 'PENDING',
    "replied_at"          TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_reviews_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_tenant_id_key" UNIQUE ("tenant_id");
ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_google_review_id_key" UNIQUE ("google_review_id");

-- Indexes
CREATE INDEX "google_reviews_tenant_id_idx" ON "google_reviews"("tenant_id");
CREATE INDEX "google_reviews_status_idx" ON "google_reviews"("status");

-- Foreign keys
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "google_business_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
