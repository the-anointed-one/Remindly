-- AlterTable
ALTER TABLE "subscription_records" ADD COLUMN     "current_period_end" TIMESTAMP(3),
ADD COLUMN     "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
ALTER COLUMN "start_date" DROP NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'NGN';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "paystack_customer_id" TEXT;
