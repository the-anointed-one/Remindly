-- Add referral_code to users
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "referral_code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");

-- Create referrals table
CREATE TABLE "referrals" (
    "id"               UUID      NOT NULL DEFAULT gen_random_uuid(),
    "referrer_user_id" UUID      NOT NULL,
    "referred_user_id" UUID      NOT NULL,
    "reward_type"      TEXT      NOT NULL DEFAULT 'SMS_CREDITS',
    "reward_value"     INTEGER   NOT NULL DEFAULT 50,
    "reward_issued"    BOOLEAN   NOT NULL DEFAULT false,
    "reward_issued_at" TIMESTAMPTZ,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- One user can only be referred once
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "referrals"("referred_user_id");
CREATE INDEX "referrals_referrer_user_id_idx" ON "referrals"("referrer_user_id");

ALTER TABLE "referrals"
    ADD CONSTRAINT "referrals_referrer_user_id_fkey"
        FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referrals"
    ADD CONSTRAINT "referrals_referred_user_id_fkey"
        FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
