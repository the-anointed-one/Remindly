-- AlterTable customers: add is_demo_data flag
ALTER TABLE "customers" ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable appointments: add is_demo_data flag
ALTER TABLE "appointments" ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable reminder_rules: add is_demo_data flag
ALTER TABLE "reminder_rules" ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;
