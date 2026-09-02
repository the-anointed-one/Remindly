-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "arrived_at" TIMESTAMP(3),
ADD COLUMN     "qr_scanned_by" TEXT,
ADD COLUMN     "qr_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_qr_token_key" ON "event_participants"("qr_token");

