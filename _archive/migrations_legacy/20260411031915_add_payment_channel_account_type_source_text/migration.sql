-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ANY', 'QR', 'NFC', 'TARJETA_FISICA');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ANY', 'HABERES', 'JUBILADO', 'ANSES');

-- AlterTable
ALTER TABLE "promo_requirements" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ANY';

-- AlterTable
ALTER TABLE "promos" ADD COLUMN     "sourceText" TEXT,
ADD COLUMN     "specificDates" TEXT;

-- CreateTable
CREATE TABLE "saved_promos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_promos_userId_promoId_key" ON "saved_promos"("userId", "promoId");

-- AddForeignKey
ALTER TABLE "saved_promos" ADD CONSTRAINT "saved_promos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_promos" ADD CONSTRAINT "saved_promos_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
