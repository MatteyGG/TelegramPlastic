-- AlterTable
ALTER TABLE "public"."DialogHistory" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE INDEX "DialogHistory_username_idx" ON "public"."DialogHistory"("username");
