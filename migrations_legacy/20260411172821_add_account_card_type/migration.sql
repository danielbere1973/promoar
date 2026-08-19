/*
  Warnings:

  - You are about to drop the column `cap` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `capPeriod` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `discountType` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `discountValue` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `minPurchase` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `nxmM` on the `promos` table. All the data in the column will be lost.
  - You are about to drop the column `nxmN` on the `promos` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'Account';

-- AlterTable
ALTER TABLE "promo_requirements" ADD COLUMN     "cap" DOUBLE PRECISION,
ADD COLUMN     "capPeriod" "CapPeriod",
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE_REINTEGRO',
ADD COLUMN     "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "minPurchase" DOUBLE PRECISION,
ADD COLUMN     "nxmM" INTEGER,
ADD COLUMN     "nxmN" INTEGER,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "segmentId" TEXT;

-- AlterTable
ALTER TABLE "promos" DROP COLUMN "cap",
DROP COLUMN "capPeriod",
DROP COLUMN "discountType",
DROP COLUMN "discountValue",
DROP COLUMN "minPurchase",
DROP COLUMN "nxmM",
DROP COLUMN "nxmN";

-- AlterTable
ALTER TABLE "user_cards" ADD COLUMN     "lastFour" TEXT,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "segmentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "addressApt" TEXT,
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressFloor" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZipCode" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phoneFixed" TEXT,
ADD COLUMN     "phoneMobile" TEXT;

-- CreateTable
CREATE TABLE "bank_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,

    CONSTRAINT "bank_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_segments_bankId_name_key" ON "bank_segments"("bankId", "name");

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "bank_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_segments" ADD CONSTRAINT "bank_segments_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "bank_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
