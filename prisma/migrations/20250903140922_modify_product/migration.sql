-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "characteristics" TEXT,
ALTER COLUMN "weight" DROP NOT NULL;
