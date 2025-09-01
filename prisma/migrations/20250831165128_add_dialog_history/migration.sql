/*
  Warnings:

  - You are about to drop the `faqs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."faqs";

-- CreateTable
CREATE TABLE "public"."DialogHistory" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "products" TEXT,

    CONSTRAINT "DialogHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DialogHistory_chatId_idx" ON "public"."DialogHistory"("chatId");

-- CreateIndex
CREATE INDEX "DialogHistory_timestamp_idx" ON "public"."DialogHistory"("timestamp");
