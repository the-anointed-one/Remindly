-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "coupon_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "incentive_message" TEXT,
ADD COLUMN     "incentive_type" TEXT DEFAULT 'none',
ADD COLUMN     "incentive_value" TEXT;

