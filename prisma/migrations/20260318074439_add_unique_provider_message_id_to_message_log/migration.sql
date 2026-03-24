/*
  Warnings:

  - A unique constraint covering the columns `[provider_message_id]` on the table `message_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "message_logs_provider_message_id_key" ON "message_logs"("provider_message_id");
