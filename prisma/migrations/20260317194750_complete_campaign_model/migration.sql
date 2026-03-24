/*
  Warnings:

  - The `status` column on the `campaigns` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "body" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "scheduled_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';
