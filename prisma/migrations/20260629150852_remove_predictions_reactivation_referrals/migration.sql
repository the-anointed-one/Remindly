-- DropForeignKey
ALTER TABLE "prediction_logs" DROP CONSTRAINT "prediction_logs_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "prediction_logs" DROP CONSTRAINT "prediction_logs_event_id_fkey";

-- DropForeignKey
ALTER TABLE "prediction_logs" DROP CONSTRAINT "prediction_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "reactivation_campaigns" DROP CONSTRAINT "reactivation_campaigns_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "reactivation_contacts" DROP CONSTRAINT "reactivation_contacts_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "reactivation_contacts" DROP CONSTRAINT "reactivation_contacts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "referrals" DROP CONSTRAINT "referrals_referred_user_id_fkey";

-- DropForeignKey
ALTER TABLE "referrals" DROP CONSTRAINT "referrals_referrer_user_id_fkey";

-- DropIndex
DROP INDEX "appointments_no_show_risk_score_idx";

-- DropIndex
DROP INDEX "users_referral_code_key";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "no_show_risk_score";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "referral_code";

-- DropTable
DROP TABLE "prediction_logs";

-- DropTable
DROP TABLE "reactivation_campaigns";

-- DropTable
DROP TABLE "reactivation_contacts";

-- DropTable
DROP TABLE "referrals";

